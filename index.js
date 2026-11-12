/**
 * CodeQuest for DSH — Host half.
 *
 * Reads DSH session logs through `ctx.sessionQuery`, folds them into usage
 * summaries, evaluates the achievement set, and exposes everything to the Web
 * GUI over same-origin JSON routes. Optionally syncs to a codequest-server for
 * the leaderboard.
 *
 * State lives under `$DSH_HOME/storages/dsh-codequest/state.json`.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACHIEVEMENTS, CATEGORY_LABELS, evaluate } from './achievements.js';
import { aggregate, foldSession, FOLD_VERSION } from './scan.js';
import { CloudClient, CloudError, progressFromMetrics } from './cloud.js';

export const name = 'dsh-codequest';

const PREFIX = '/dsh-codequest';
/** Bumped whenever the fold/metrics semantics change; surfaced for diagnostics. */
const BUILD = '2026-11-13.1';

/**
 * No endpoint ships with the package: a public repo must not point at the
 * author's own server. Set it per install through `POST /config {cloudBase}`
 * (stored in `state.json`) or the `DSH_CODEQUEST_CLOUD` environment variable.
 */
const DEFAULT_CLOUD_BASE = process.env.DSH_CODEQUEST_CLOUD || '';
const STATE_VERSION = 1;
const LIVE_REFRESH_MS = 20_000;
const AUTO_SCAN_MS = 10 * 60_000;
/** The HUD polls /live every 3s; a fold older than this gets refreshed. */
const LIVE_SCAN_MS = 6_000;
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Shared secret with codequest-server's `DSH_SHARED_SECRET`. The Host signs the
 * DeepSeek account identity it reads locally so the server can tell a real
 * Harness sign-in from a forged one.
 *
 * The value is NOT baked into this package: set it per install through
 * `POST /dsh-codequest/config {sharedSecret}` (stored in `state.json`) or the
 * `DSH_SHARED_SECRET` environment variable. Both sides must match.
 */
const PLACEHOLDER_SHARED_SECRET = 'change-me-codequest-shared-secret';
const PLUGIN_VERSION = '0.7.0';

/** Achievement badges ship with the package and are served as static WebP. */
const ICON_ROOT = fileURLToPath(new URL('./assets/icons/', import.meta.url));
/** Level-tier portraits, one per title tier (1-7). */
const LEVEL_ROOT = fileURLToPath(new URL('./assets/levels/', import.meta.url));

function stateDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'storages', 'dsh-codequest');
}

function stateFile() {
  return path.join(stateDir(), 'state.json');
}

function defaultState() {
  return {
    version: STATE_VERSION,
    sessions: {},
    unlocked: {},
    cloud: {
      base: DEFAULT_CLOUD_BASE,
      token: null,
      user: null,
      lastSyncAt: 0,
      lastError: null,
      dsh: null,
      authMode: null,
      sharedSecret: null,
      syncCount: 0,
      bestRank: 0,
      players: 0,
      seasonStart: null,
    },
    meta: { firstSeenAt: Date.now() },
  };
}

function loadState() {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STATE_VERSION) return defaultState();
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      unlocked: parsed.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {},
      cloud: { ...base.cloud, ...(parsed.cloud || {}) },
      meta: { ...base.meta, ...(parsed.meta || {}) },
    };
  } catch {
    return defaultState();
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === req.headers.host;
  } catch {
    return false;
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

function trimDaily(dailyTokens) {
  const entries = Object.entries(dailyTokens || {}).sort(([a], [b]) => (a < b ? -1 : 1));
  return Object.fromEntries(entries.slice(-120));
}

function topEntries(counts, limit) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }));
}

export function apply(ctx) {
  const state = loadState();
  const runtime = {
    metrics: null,
    evaluation: null,
    scanning: false,
    scanDone: 0,
    scanTotal: 0,
    lastScanAt: 0,
    lastError: null,
    saveTimer: null,
  };

  const cloud = new CloudClient(state.cloud.base || DEFAULT_CLOUD_BASE);
  cloud.setToken(state.cloud.token);

  function save() {
    if (runtime.saveTimer) return;
    runtime.saveTimer = setTimeout(() => {
      runtime.saveTimer = null;
      try {
        fs.mkdirSync(stateDir(), { recursive: true });
        const tmp = `${stateFile()}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, stateFile());
      } catch (error) {
        ctx.logger?.warn?.(`dsh-codequest: state save failed: ${String(error)}`);
      }
    }, 800);
    runtime.saveTimer.unref?.();
  }

  function recompute() {
    runtime.metrics = aggregate(state.sessions);
    // Drop unlock records for achievements that no longer exist (renamed or
    // retired ids), so the counter and the point total stay in sync.
    const known = new Set(ACHIEVEMENTS.map((item) => item.id));
    for (const id of Object.keys(state.unlocked)) {
      if (!known.has(id)) delete state.unlocked[id];
    }
    runtime.evaluation = evaluate(runtime.metrics, state.unlocked, Date.now(), {
      cloud: {
        loggedIn: Boolean(state.cloud.token),
        syncs: Number(state.cloud.syncCount) || 0,
        bestRank: Number(state.cloud.bestRank) || 0,
        achievements: Number(state.cloud.user && state.cloud.user.achievementCount) || 0,
        season: Boolean(state.cloud.seasonStart),
        players: Number(state.cloud.players) || 0,
      },
    });
    if (runtime.evaluation.fresh.length > 0) {
      state.unlocked = runtime.evaluation.unlocked;
      save();
      ctx.logger?.info?.(`dsh-codequest: unlocked ${runtime.evaluation.fresh.join(', ')}`);
    }
    return runtime.metrics;
  }

  function metricsNow() {
    if (!runtime.metrics) recompute();
    return runtime.metrics;
  }

  function evaluationNow() {
    if (!runtime.evaluation) recompute();
    return runtime.evaluation;
  }

  /** Read one session's events: in-memory for live sessions, log replay otherwise. */
  async function eventsOf(sessionQuery, sessionId, live) {
    if (live) {
      const sessions = ctx.get('sessions');
      const session = sessions && typeof sessions.get === 'function' ? sessions.get(sessionId) : undefined;
      if (session && typeof session.snapshotEvents === 'function') {
        return { events: session.snapshotEvents(), header: session.header };
      }
    }
    const snapshot = await sessionQuery.readSession(sessionId);
    return { events: snapshot.events, header: snapshot.session };
  }

  async function scan(options = {}) {
    if (runtime.scanning) return;
    const sessionQuery = ctx.get('sessionQuery');
    if (!sessionQuery || typeof sessionQuery.listSessions !== 'function') {
      runtime.lastError = 'sessionQuery unavailable';
      return;
    }
    const force = options.force === true;
    runtime.scanning = true;
    runtime.scanDone = 0;
    runtime.scanTotal = 0;
    try {
      const records = await sessionQuery.listSessions();
      const list = Array.isArray(records) ? records : [];
      runtime.scanTotal = list.length;
      let index = 0;
      for (const record of list) {
        index += 1;
        runtime.scanDone = index;
        const header = record && record.header;
        const id = header && header.id;
        if (!id) continue;
        const live = Boolean(record.live);
        const cached = state.sessions[id];
        // Persisted sessions are immutable once folded; live ones keep changing.
        // A stale fold version means the cached metrics no longer mean the same
        // thing, so it is rebuilt even for a persisted session.
        const fresh = cached && cached.foldVersion === FOLD_VERSION;
        if (fresh && !live && !force) continue;
        try {
          const { events, header: readHeader } = await eventsOf(sessionQuery, id, live);
          state.sessions[id] = {
            fold: foldSession(readHeader || header, events || []),
            foldVersion: FOLD_VERSION,
            foldedAt: Date.now(),
            events: Array.isArray(events) ? events.length : 0,
            live,
          };
          runtime.lastError = null;
        } catch (error) {
          runtime.lastError = `fold ${id}: ${String((error && error.message) || error)}`;
        }
        if (index % 8 === 0) save();
        // Yield so the Host stays responsive during a first full scan.
        await new Promise((resolve) => setImmediate(resolve));
      }
      runtime.lastScanAt = Date.now();
      recompute();
    } catch (error) {
      runtime.lastError = `scan: ${String((error && error.message) || error)}`;
      ctx.logger?.warn?.(`dsh-codequest: ${runtime.lastError}`);
    } finally {
      runtime.scanning = false;
      save();
    }
  }

  function statsPayload() {
    const metrics = metricsNow();
    const evaluation = evaluationNow();
    const unlockedCount = evaluation.items.filter((item) => item.unlockedAt).length;
    return {
      scan: {
        sessions: Object.keys(state.sessions).length,
        scanning: runtime.scanning,
        done: runtime.scanDone,
        total: runtime.scanTotal,
        lastScanAt: runtime.lastScanAt,
        error: runtime.lastError,
      },
      stats: {
        tokens: metrics.tokens,
        tokensToday: metrics.tokensToday,
        input: metrics.input,
        output: metrics.output,
        cacheRead: metrics.cacheRead,
        cacheWrite: metrics.cacheWrite,
        reasoning: metrics.reasoning,
        sessions: metrics.sessions,
        sessionsToday: metrics.sessionsToday,
        turns: metrics.turns,
        toolCalls: metrics.toolCalls,
        toolErrors: metrics.toolErrors,
        distinctTools: metrics.distinctTools,
        distinctModels: metrics.distinctModels,
        distinctProviders: metrics.distinctProviders,
        projects: metrics.projects,
        activeDays: metrics.activeDays,
        maxStreak: metrics.maxStreak,
        maxDailyTokens: metrics.maxDailyTokens,
        maxSessionTokens: metrics.maxSessionTokens,
        cacheHitRate: Number(metrics.cacheHitRate.toFixed(4)),
        nightSessions: metrics.nightSessions,
        earlySessions: metrics.earlySessions,
        weekendSessions: metrics.weekendSessions,
        promptChars: metrics.promptChars,
        humanPrompts: metrics.humanPrompts,
        assistantChars: metrics.assistantChars,
        codeBlocks: metrics.codeBlocks,
        totalFences: metrics.totalFences,
        distinctFenceLangs: metrics.distinctFenceLangs,
        signals: metrics.signals,
        assistant: metrics.assistant,
        topSignals: topEntries(metrics.signals, 16),
        topExts: topEntries(metrics.exts, 10),
        topCmds: topEntries(metrics.cmds, 8),
        topFences: topEntries(metrics.assistant.fences, 10),
        sentiment: metrics.sentiment,
        dailyTokens: trimDaily(metrics.dailyTokens),
        hourly: metrics.hourly,
        topTools: topEntries(metrics.tools, 12),
        topModels: topEntries(metrics.models, 6),
        firstAt: metrics.firstAt,
        lastAt: metrics.lastAt,
      },
      progress: {
        points: evaluation.points,
        level: evaluation.level,
        levelInto: evaluation.levelInto,
        levelNeed: evaluation.levelNeed,
        title: evaluation.title,
        unlocked: unlockedCount,
        total: ACHIEVEMENTS.length,
      },
      achievements: evaluation.items,
      categories: CATEGORY_LABELS,
      cloud: {
        base: state.cloud.base,
        loggedIn: Boolean(state.cloud.token),
        user: state.cloud.user,
        lastSyncAt: state.cloud.lastSyncAt,
        lastError: state.cloud.lastError,
        authMode: state.cloud.authMode || null,
        dsh: state.cloud.dsh || null,
        hasSecret: Boolean(state.cloud.sharedSecret),
        boards: state.cloud.boards || {},
      },
    };
  }

  async function pushCloud() {
    if (!state.cloud.token) throw new CloudError('not_logged_in', 401);
    const metrics = metricsNow();
    const evaluation = evaluationNow();
    const achievements = Object.entries(state.unlocked).map(([id, unlockedAt]) => ({ id, unlockedAt }));
    if (achievements.length > 0) await cloud.syncAchievements(achievements, true);
    const season = await cloud.startSeason(state.cloud.statsEpochMs || Date.now());
    if (season && season.statsEpochMs) {
      state.cloud.statsEpochMs = season.statsEpochMs;
      if (!state.cloud.seasonStart) state.cloud.seasonStart = season.statsEpochMs;
    }
    const progress = progressFromMetrics(metrics, evaluation);
    const pushed = await cloud.syncProgress(progress);
    state.cloud.lastSyncAt = Date.now();
    state.cloud.lastError = null;
    if (pushed && pushed.progress) state.cloud.progress = pushed.progress;
    save();
    return {
      syncedAchievements: achievements.length,
      progress: (pushed && pushed.progress) || progress,
      points: evaluation.points,
    };
  }

  /** @returns {string} per-install shared secret, else the documented placeholder. */
  function sharedSecret() {
    const stored = state.cloud && typeof state.cloud.sharedSecret === 'string' ? state.cloud.sharedSecret : '';
    return stored || process.env.DSH_SHARED_SECRET || PLACEHOLDER_SHARED_SECRET;
  }

  /**
   * Read the DeepSeek account already signed into this Harness, so the
   * leaderboard needs no separate email/password.
   */
  async function dshIdentity() {
    const account = ctx.get('deepseekAccount');
    if (!account) return { available: false, signedIn: false, profile: null };
    try {
      const view = await account.getState();
      if (!view || view.status !== 'credential-stored') {
        return { available: true, signedIn: false, profile: null };
      }
      const profile = await account.getProfile({
        version: PLUGIN_VERSION,
        locale: 'zh-CN',
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      });
      const value = profile && profile.status === 'ready' ? profile.value : null;
      return {
        available: true,
        signedIn: true,
        profile: value
          ? {
              id: value.id || null,
              name: value.name || null,
              contact: value.contact || null,
              avatarUrl: value.avatarUrl || null,
            }
          : null,
      };
    } catch (error) {
      return {
        available: true,
        signedIn: false,
        profile: null,
        error: String((error && error.message) || error),
      };
    }
  }

  function routeHandlers() {
    return [
      {
        path: `${PREFIX}/state`,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          const stale = Date.now() - runtime.lastScanAt > LIVE_REFRESH_MS;
          if (stale && !runtime.scanning) void scan();
          return json(res, 200, { ok: true, build: BUILD, ...statsPayload() });
        },
      },
      {
        /**
         * Cheap snapshot for the floating HUD: the full /state payload carries
         * 300+ achievement rows, which is far too much to poll every few
         * seconds. This reads the cached evaluation only and never scans.
         */
        path: `${PREFIX}/live`,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          // Keep the HUD honest: a stale fold is what makes the counter look
          // frozen, so nudge a scan here too (cheap while idle, incremental).
          if (Date.now() - runtime.lastScanAt > LIVE_SCAN_MS && !runtime.scanning) void scan();
          const metrics = metricsNow();
          const evaluation = evaluationNow();
          let unlocked = 0;
          for (const item of evaluation.items) if (item.unlockedAt) unlocked += 1;
          return json(res, 200, {
            ok: true,
            at: Date.now(),
            tokens: metrics.tokens || 0,
            tokensToday: metrics.tokensToday || 0,
            sessions: metrics.sessions || 0,
            toolCalls: metrics.toolCalls || 0,
            streak: metrics.maxStreak || 0,
            points: evaluation.points || 0,
            level: evaluation.level || 1,
            title: evaluation.title || '',
            unlocked,
            total: ACHIEVEMENTS.length,
            levelInto: evaluation.levelInto || 0,
            levelNeed: evaluation.levelNeed || 0,
          });
        },
      },
      {
        path: `${PREFIX}/refresh`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          let force = false;
          try {
            const body = await readJsonBody(req);
            force = body && body.force === true;
          } catch {
            force = false;
          }
          void scan({ force });
          return json(res, 200, { ok: true, scanning: true });
        },
      },
      {
        path: `${PREFIX}/config`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          let body;
          try {
            body = await readJsonBody(req);
          } catch {
            return json(res, 400, { ok: false, error: 'invalid_json' });
          }
          const base = typeof body.cloudBase === 'string' ? body.cloudBase.trim() : '';
          if (base && !/^https?:\/\//i.test(base)) return json(res, 400, { ok: false, error: 'invalid_url' });
          if (base) {
            state.cloud.base = base.replace(/\/+$/, '');
            cloud.base = state.cloud.base;
            save();
          }
          if (typeof body.sharedSecret === 'string') {
            const secret = body.sharedSecret.trim();
            if (secret && secret.length < 8) return json(res, 400, { ok: false, error: 'secret_too_short' });
            state.cloud.sharedSecret = secret || null;
            save();
          }
          return json(res, 200, {
            ok: true,
            base: state.cloud.base,
            hasSecret: Boolean(state.cloud.sharedSecret),
        boards: state.cloud.boards || {},
          });
        },
      },
      {
        path: `${PREFIX}/account`,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          const identity = await dshIdentity();
          state.cloud.dsh = identity.profile
            ? { name: identity.profile.name, contact: identity.profile.contact }
            : null;
          save();
          return json(res, 200, { ok: true, ...identity });
        },
      },
      {
        path: `${PREFIX}/cloud/dsh-login`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          const identity = await dshIdentity();
          if (!identity.available) return json(res, 200, { ok: false, error: 'dsh_account_unavailable' });
          if (!identity.signedIn) return json(res, 200, { ok: false, error: 'dsh_signed_out' });
          if (!identity.profile) return json(res, 200, { ok: false, error: 'dsh_identity_missing' });
          const accountKey = String(identity.profile.id || identity.profile.contact || '');
          if (!accountKey) return json(res, 200, { ok: false, error: 'dsh_identity_missing' });
          const contact = String(identity.profile.contact || '').toLowerCase();
          // `contact` is usually a masked phone number; only a real email is
          // worth carrying to the server as the account email.
          const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : '';
          const signature = crypto
            .createHmac('sha256', sharedSecret())
            .update(`${accountKey}|${email}`)
            .digest('hex');
          try {
            const data = await cloud.dshLogin({
              accountKey,
              contact: email,
              name: identity.profile.name || '',
              avatarUrl: identity.profile.avatarUrl || '',
              signature,
            });
            state.cloud.token = data.token || cloud.token;
            state.cloud.user = data.user || null;
            state.cloud.lastError = null;
            state.cloud.authMode = 'dsh';
            state.cloud.dsh = {
              name: identity.profile.name || null,
              contact: identity.profile.contact || null,
            };
            cloud.setToken(state.cloud.token);
            save();
            return json(res, 200, {
              ok: true,
              user: state.cloud.user,
              created: Boolean(data.created),
            });
          } catch (error) {
            state.cloud.lastError = String(error.message || error);
            save();
            return json(res, 200, { ok: false, error: state.cloud.lastError });
          }
        },
      },
      {
        path: `${PREFIX}/cloud/login`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          let body;
          try {
            body = await readJsonBody(req);
          } catch {
            return json(res, 400, { ok: false, error: 'invalid_json' });
          }
          try {
            const data = await cloud.login(String(body.email || ''), String(body.password || ''));
            state.cloud.token = data.token || cloud.token;
            state.cloud.user = data.user || null;
            state.cloud.lastError = null;
            state.cloud.authMode = 'email';
            cloud.setToken(state.cloud.token);
            save();
            return json(res, 200, { ok: true, user: state.cloud.user });
          } catch (error) {
            state.cloud.lastError = String(error.message || error);
            save();
            return json(res, 200, { ok: false, error: state.cloud.lastError });
          }
        },
      },
      {
        path: `${PREFIX}/cloud/register`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          let body;
          try {
            body = await readJsonBody(req);
          } catch {
            return json(res, 400, { ok: false, error: 'invalid_json' });
          }
          try {
            const data = await cloud.register(
              String(body.email || ''),
              String(body.password || ''),
              String(body.displayName || ''),
            );
            state.cloud.token = data.token || cloud.token;
            state.cloud.user = data.user || null;
            state.cloud.lastError = null;
            state.cloud.authMode = 'email';
            cloud.setToken(state.cloud.token);
            save();
            return json(res, 200, { ok: true, user: state.cloud.user });
          } catch (error) {
            state.cloud.lastError = String(error.message || error);
            save();
            return json(res, 200, { ok: false, error: state.cloud.lastError });
          }
        },
      },
      {
        path: `${PREFIX}/cloud/logout`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          try {
            await cloud.logout();
          } catch {
            /* token may already be invalid server-side */
          }
          state.cloud.token = null;
          state.cloud.user = null;
          state.cloud.progress = null;
          cloud.setToken(null);
          save();
          return json(res, 200, { ok: true });
        },
      },
      {
        path: `${PREFIX}/cloud/sync`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          try {
            const result = await pushCloud();
            state.cloud.syncCount = (Number(state.cloud.syncCount) || 0) + 1;
            save();
            recompute();
            return json(res, 200, { ok: true, ...result });
          } catch (error) {
            state.cloud.lastError = String((error && error.message) || error);
            save();
            return json(res, 200, { ok: false, error: state.cloud.lastError });
          }
        },
      },
      {
        path: `${PREFIX}/cloud/leaderboard`,
        handler: async (req, res) => {
          if (req.method !== 'POST' && req.method !== 'GET') {
            return json(res, 405, { ok: false, error: 'method_not_allowed' });
          }
          if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross_origin' });
          const url = new URL(req.url || '/', 'http://localhost');
          const kind = String(url.searchParams.get('kind') || 'achievements').slice(0, 24);
          try {
            const data = await cloud.leaderboard(50, kind);
            const items = data.items || [];
            state.cloud.players = items.length;
            const me = state.cloud.user && items.find((row) => row.userId === state.cloud.user.id);
            if (me && me.rank) {
              const best = Number(state.cloud.bestRank) || 0;
              if (!best || me.rank < best) state.cloud.bestRank = me.rank;
            }
            state.cloud.boards = state.cloud.boards || {};
            state.cloud.boards[kind] = {
              label: data.label || kind,
              unit: data.unit || '',
              myRank: me ? me.rank : null,
              myValue: me ? me.value : null,
              at: Date.now(),
            };
            save();
            recompute();
            return json(res, 200, { ok: true, kind, label: data.label || kind, unit: data.unit || '', items });
          } catch (error) {
            return json(res, 200, { ok: false, error: String((error && error.message) || error) });
          }
        },
      },
    ];
  }

  /** Serve one packaged image: `/<prefix>/icon/<name>.webp` or `/level/<name>.webp`. */
  function serveArt(root) {
    return (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.end();
        return;
      }
      const pathname = String(req.url || '').split('?')[0];
      const name = pathname.slice(pathname.lastIndexOf('/') + 1);
      if (!/^[a-z0-9_]+\.webp$/i.test(name)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const file = path.join(root, name);
      fs.readFile(file, (error, buffer) => {
        if (error) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.statusCode = 200;
        res.setHeader('content-type', 'image/webp');
        res.setHeader('content-length', String(buffer.length));
        res.setHeader('cache-control', 'public, max-age=604800, immutable');
        res.end(req.method === 'HEAD' ? undefined : buffer);
      });
    };
  }

  const serveIcon = serveArt(ICON_ROOT);
  const serveLevel = serveArt(LEVEL_ROOT);

  ctx.effect(() => {
    const timer = setTimeout(() => {
      void scan();
    }, 2500);
    timer.unref?.();
    const interval = setInterval(() => {
      void scan();
    }, AUTO_SCAN_MS);
    interval.unref?.();
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      if (runtime.saveTimer) clearTimeout(runtime.saveTimer);
    };
  }, 'dsh-codequest: scan schedule');

  ctx.inject(['webServer'], (webCtx) => {
    // The GUI is served at the origin root in Desktop and under `/dsh/` behind
    // the cloud gateway; the Client resolves its API base from the page path,
    // so both spellings must answer.
    for (const route of routeHandlers()) {
      for (const prefix of ['', '/dsh']) {
        const path = `${prefix}${route.path}`;
        webCtx.effect(
          () => webCtx.webServer.register({ kind: 'exact', path, handler: route.handler }),
          `dsh-codequest: route ${path}`,
        );
      }
    }
    // Badge art: one prefix route per deployment prefix, not one route per file.
    for (const prefix of ['', '/dsh']) {
      const iconPath = `${prefix}${PREFIX}/icon`;
      webCtx.effect(
        () => webCtx.webServer.register({ kind: 'prefix', path: iconPath, handler: serveIcon }),
        `dsh-codequest: icons ${iconPath}`,
      );
      const levelPath = `${prefix}${PREFIX}/level`;
      webCtx.effect(
        () => webCtx.webServer.register({ kind: 'prefix', path: levelPath, handler: serveLevel }),
        `dsh-codequest: levels ${levelPath}`,
      );
    }
  });

  recompute();
  ctx.logger?.info?.(`dsh-codequest: ready (${Object.keys(state.sessions).length} cached session(s))`);
}














