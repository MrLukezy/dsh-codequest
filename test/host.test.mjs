/**
 * Host integration harness: drives dsh-codequest's real `apply()` against the
 * real session logs on this machine, through a minimal Cordis-shaped context.
 * Verifies collection, achievement evaluation, state persistence and the HTTP
 * route surface without restarting the running Harness.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
function frames(buf) {
  const starts = [];
  let from = 0;
  for (;;) {
    const at = buf.indexOf(MAGIC, from);
    if (at < 0) break;
    starts.push(at);
    from = at + 4;
  }
  return starts.map((s, i) => buf.subarray(s, i + 1 < starts.length ? starts[i + 1] : buf.length));
}

function readSessionFile(file) {
  const parts = [];
  for (const frame of frames(fs.readFileSync(file))) {
    try {
      parts.push(zlib.zstdDecompressSync(frame));
    } catch {
      parts.push(Buffer.from(''));
    }
  }
  let header = null;
  const events = [];
  for (const line of Buffer.concat(parts).toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev.type === 'session') header = ev;
    else events.push(ev);
  }
  return { header, events };
}

const sessionsRoot = process.argv[2];
const cache = new Map();
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.zstd')) files.push(full);
  }
})(sessionsRoot);

for (const file of files) {
  const { header, events } = readSessionFile(file);
  if (header) cache.set(header.id, { header, events });
}

const sessionQuery = {
  async listSessions() {
    return [...cache.values()]
      .sort((a, b) => b.header.createdAt - a.header.createdAt)
      .map(({ header }) => ({ header, live: false, persisted: true }));
  },
  async readSession(id) {
    const hit = cache.get(id);
    if (!hit) throw new Error(`unknown session ${id}`);
    return { session: hit.header, events: hit.events };
  },
};

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-cq-test-'));
process.env.DSH_HOME = tempHome;

const routes = new Map();
const cleanups = [];

const webServer = {
  register(route) {
    routes.set(route.path, route);
    return () => routes.delete(route.path);
  },
};

function makeCtx() {
  return {
    logger: { info() {}, warn() {}, error() {} },
    effect(fn) {
      const dispose = fn();
      if (typeof dispose === 'function') cleanups.push(dispose);
      return () => {};
    },
    inject(_deps, callback) {
      callback({ effect: (fn) => fn(), webServer });
    },
    get(name) {
      return name === 'sessionQuery' ? sessionQuery : undefined;
    },
  };
}

const { apply } = await import('../index.js');
apply(makeCtx());

function fakeReq(method, body) {
  const listeners = new Map();
  const req = {
    method,
    headers: { host: '127.0.0.1:64903' },
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(cb);
      return req;
    },
    destroy() {},
  };
  setImmediate(() => {
    const data = listeners.get('data') || [];
    const end = listeners.get('end') || [];
    if (body !== undefined) {
      const buf = Buffer.from(JSON.stringify(body));
      for (const cb of data) cb(buf);
    }
    for (const cb of end) cb();
  });
  return req;
}

function invoke(path, method, body) {
  const route = routes.get(path);
  if (!route) throw new Error(`route not registered: ${path}`);
  return new Promise((resolve, reject) => {
    const chunks = [];
    const res = {
      statusCode: 0,
      setHeader() {},
      end(payload) {
        chunks.push(payload);
        resolve({ status: res.statusCode, body: JSON.parse(chunks.join('')) });
      },
    };
    Promise.resolve(route.handler(fakeReq(method, body), res)).catch(reject);
  });
}

const registered = [...routes.keys()].sort();
console.log('routes:', registered.length);
for (const p of registered) console.log('  ', p);

const refresh = await invoke('/dsh-codequest/refresh', 'POST', { force: true });
console.log('refresh:', refresh.status, JSON.stringify(refresh.body));

// Wait for the background scan to settle.
for (let i = 0; i < 120; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  const state = await invoke('/dsh-codequest/state', 'GET');
  if (!state.body.scan.scanning) {
    const s = state.body.stats;
    const p = state.body.progress;
    console.log('\n--- state ---');
    console.log('build:', state.body.build);
    console.log('scan:', JSON.stringify(state.body.scan));
    console.log('tokens:', s.tokens, 'today:', s.tokensToday, 'sessions:', s.sessions);
    console.log('tools:', s.toolCalls, 'distinct:', s.distinctTools, 'models:', s.distinctModels);
    console.log('promptChars:', s.promptChars, 'assistantChars:', s.assistantChars, 'codeBlocks:', s.codeBlocks);
    console.log('activeDays:', s.activeDays, 'streak:', s.maxStreak, 'cacheHit:', s.cacheHitRate);
    console.log('sentiment:', JSON.stringify(s.sentiment));
    console.log('level:', p.level, 'points:', p.points, 'unlocked:', p.unlocked, '/', p.total);
    console.log('unlocked ids:', state.body.achievements.filter((a) => a.unlockedAt).map((a) => a.id).join(', '));
    await new Promise((r) => setTimeout(r, 1500));
    console.log('state file bytes:', fs.statSync(path.join(tempHome, 'storages', 'dsh-codequest', 'state.json')).size);
    break;
  }
}

// A fresh install must already point at the built-in leaderboard, and an
// explicit empty value must fall back to it rather than to "not configured".
const finalState = await invoke('/dsh-codequest/state', 'GET');
const freshBase = finalState.body.cloud.base;
if (!/^https?:\/\//.test(freshBase)) throw new Error(`fresh install has no cloud base: ${freshBase}`);
console.log('cloud base (built in):', freshBase);
const cleared = await invoke('/dsh-codequest/config', 'POST', { cloudBase: '' });
if (cleared.body.base !== freshBase) throw new Error(`empty cloudBase should restore the default, got ${cleared.body.base}`);
console.log('cloud base (after clearing):', cleared.body.base);

const leaderboard = await invoke('/dsh-codequest/cloud/leaderboard', 'POST', {});
console.log('\nleaderboard:', leaderboard.status, JSON.stringify(leaderboard.body).slice(0, 300));

for (const dispose of cleanups) {
  try {
    dispose();
  } catch {
    /* ignore */
  }
}
fs.rmSync(tempHome, { recursive: true, force: true });
