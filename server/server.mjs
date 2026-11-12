/**
 * CodeQuest 账号 / 成就同步 / 小游戏排行 / 管理后台 API
 * 部署：nginx 反代到本进程（默认 3010）
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "codequest.db");
const PORT = Number(process.env.PORT || 3010);
const BASE_PATH = (process.env.BASE_PATH || "/codequest").replace(/\/$/, "");
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "codequest-dev-secret-change-me-in-prod-9f3a2b";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "codequest-admin-2026";
const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const STEAM_REALM =
  process.env.STEAM_REALM || "http://localhost:3010";
const STEAM_RETURN =
  process.env.STEAM_RETURN ||
  `${process.env.STEAM_REALM || "http://localhost:3010"}${process.env.BASE_PATH || "/codequest"}/api/auth/steam/callback`;
/**
 * 与 dsh-codequest 插件共享的签名密钥：插件用它在本地证明「这条身份来自本机
 * 已登录的 DeepSeek 账号」，服务端据此免密建号。留空则该登录方式关闭。
 */
const DSH_SHARED_SECRET = process.env.DSH_SHARED_SECRET || "change-me-codequest-shared-secret";

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  steam_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  banned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  -- Which install reported it. Two machines on one account each keep their own
  -- rows; the user's collection is the union, so a fresh laptop cannot wipe a
  -- desktop's progress.
  device_id TEXT NOT NULL DEFAULT '',
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, achievement_id, device_id)
);

CREATE TABLE IF NOT EXISTS minigame_scores (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  best_score REAL NOT NULL DEFAULT 0,
  best_time_ms INTEGER,
  best_stars INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, achievement_id, game_id)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ach_user ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_score_ach ON minigame_scores(achievement_id, best_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

/** 迁移：赛季起点 + 进度快照（幂等） */
for (const col of [
  "ALTER TABLE users ADD COLUMN stats_epoch_ms INTEGER",
  "ALTER TABLE users ADD COLUMN progress_json TEXT",
  "ALTER TABLE users ADD COLUMN progress_updated_at INTEGER",
  "ALTER TABLE users ADD COLUMN dsh_account_id TEXT",
]) {
  try {
    db.exec(col);
  } catch {
    // column already exists
  }
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dsh ON users(dsh_account_id)"
);

/**
 * 迁移：成就表增加设备维度。
 * 老库的 `achievements` 主键是 (user_id, achievement_id)，无法原地加列，
 * 因此重建表并把已有行归到 device_id='' 名下（等价于「旧设备」）。
 */
{
  const columns = db.prepare("PRAGMA table_info(achievements)").all().map((c) => c.name);
  if (!columns.includes("device_id")) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE achievements_v2 (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          achievement_id TEXT NOT NULL,
          device_id TEXT NOT NULL DEFAULT '',
          unlocked_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, achievement_id, device_id)
        );
        INSERT INTO achievements_v2 (user_id, achievement_id, device_id, unlocked_at)
          SELECT user_id, achievement_id, '', unlocked_at FROM achievements;
        DROP TABLE achievements;
        ALTER TABLE achievements_v2 RENAME TO achievements;
        CREATE INDEX IF NOT EXISTS idx_ach_user ON achievements(user_id);
      `);
    });
    migrate();
    console.log("[codequest] migrated achievements to device-scoped rows");
  }
}

function emptyProgress() {
  return {
    totalTokens: 0,
    totalSessions: 0,
    // Board-facing scalars. All monotonic: a leaderboard must never go down
    // because a client re-synced with a smaller number.
    points: 0,
    level: 1,
    maxStreak: 0,
    activeDays: 0,
    todayTokens: 0,
    toolCalls: 0,
    codeBlocks: 0,
    promptChars: 0,
    updatedAt: 0,
    sentiment: { praise: 0, insult: 0, pua: 0, beg: 0, blame: 0 },
    sources: {},
  };
}

function parseProgress(raw) {
  if (!raw) return emptyProgress();
  try {
    const p = typeof raw === "string" ? JSON.parse(raw) : raw;
    const base = emptyProgress();
    return {
      totalTokens: Math.max(0, Number(p?.totalTokens) || 0),
      totalSessions: Math.max(0, Number(p?.totalSessions) || 0),
      points: Math.max(0, Number(p?.points) || 0),
      level: Math.max(1, Number(p?.level) || 1),
      maxStreak: Math.max(0, Number(p?.maxStreak) || 0),
      activeDays: Math.max(0, Number(p?.activeDays) || 0),
      todayTokens: Math.max(0, Number(p?.todayTokens) || 0),
      toolCalls: Math.max(0, Number(p?.toolCalls) || 0),
      codeBlocks: Math.max(0, Number(p?.codeBlocks) || 0),
      promptChars: Math.max(0, Number(p?.promptChars) || 0),
      updatedAt: Math.max(0, Number(p?.updatedAt) || 0),
      sentiment: {
        praise: Math.max(0, Number(p?.sentiment?.praise) || 0),
        insult: Math.max(0, Number(p?.sentiment?.insult) || 0),
        pua: Math.max(0, Number(p?.sentiment?.pua) || 0),
        beg: Math.max(0, Number(p?.sentiment?.beg) || 0),
        blame: Math.max(0, Number(p?.sentiment?.blame) || 0),
      },
      sources:
        p?.sources && typeof p.sources === "object" && !Array.isArray(p.sources)
          ? Object.fromEntries(
              Object.entries(p.sources).map(([k, v]) => [
                String(k),
                Math.max(0, Number(v) || 0),
              ])
            )
          : {},
    };
  } catch {
    return emptyProgress();
  }
}

/** 字段级 MAX 合并（单调不减） */
function mergeProgress(cloud, local) {
  const a = parseProgress(cloud);
  const b = parseProgress(local);
  const sources = { ...a.sources };
  for (const [k, v] of Object.entries(b.sources)) {
    sources[k] = Math.max(sources[k] || 0, v);
  }
  return {
    totalTokens: Math.max(a.totalTokens, b.totalTokens),
    totalSessions: Math.max(a.totalSessions, b.totalSessions),
    points: Math.max(a.points, b.points),
    level: Math.max(a.level, b.level),
    maxStreak: Math.max(a.maxStreak, b.maxStreak),
    activeDays: Math.max(a.activeDays, b.activeDays),
    todayTokens: Math.max(a.todayTokens, b.todayTokens),
    toolCalls: Math.max(a.toolCalls, b.toolCalls),
    codeBlocks: Math.max(a.codeBlocks, b.codeBlocks),
    promptChars: Math.max(a.promptChars, b.promptChars),
    updatedAt: Math.max(a.updatedAt, b.updatedAt) || Date.now(),
    sentiment: {
      praise: Math.max(a.sentiment.praise, b.sentiment.praise),
      insult: Math.max(a.sentiment.insult, b.sentiment.insult),
      pua: Math.max(a.sentiment.pua, b.sentiment.pua),
      beg: Math.max(a.sentiment.beg, b.sentiment.beg),
      blame: Math.max(a.sentiment.blame, b.sentiment.blame),
    },
    sources,
  };
}

/** 简易内存 rate limit：key → 滑动窗口计数 */
const rateBuckets = new Map();
function rateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now - b.start >= windowMs) {
    b = { start: now, count: 0 };
    rateBuckets.set(key, b);
  }
  b.count += 1;
  return b.count <= limit;
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function scryptHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function scryptVerify(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
  } catch {
    return false;
  }
}

function signToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expires = now + 30 * 24 * 3600 * 1000;
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(token, userId, now, expires);
  return { token, expiresAt: expires };
}

function getUserByToken(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ? AND u.banned = 0`
    )
    .get(token, Date.now());
  return row || null;
}

function publicUser(u) {
  if (!u) return null;
  const achCount = db
    .prepare(`SELECT COUNT(DISTINCT achievement_id) AS c FROM achievements WHERE user_id = ?`)
    .get(u.id).c;
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    steamId: u.steam_id,
    avatarUrl: u.avatar_url,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
    achievementCount: achCount,
    dshLinked: !!u.dsh_account_id,
    statsEpochMs: u.stats_epoch_ms ?? null,
    progress: parseProgress(u.progress_json),
    progressUpdatedAt: u.progress_updated_at ?? null,
  };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : req.headers["x-auth-token"] || req.query.token;
  const user = getUserByToken(token);
  if (!user) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  req.user = user;
  req.token = token;
  next();
}

function adminMiddleware(req, res, next) {
  const user = req.headers["x-admin-user"];
  const pass = req.headers["x-admin-pass"];
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  return res.status(401).json({ ok: false, error: "admin_unauthorized" });
}

function bumpStat(key, delta = 1) {
  const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key);
  const next = String(Number(row?.value || 0) + delta);
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, next);
}

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

const api = express.Router();

/** 全局限流：每 IP 60 次/分钟 */
api.use((req, res, next) => {
  const ip = clientIp(req);
  if (!rateLimit({ key: `ip:${ip}`, limit: 60, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }
  next();
});

api.get("/health", (_req, res) => {
  res.json({ ok: true, service: "codequest", time: Date.now() });
});

api.post("/auth/register", (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || "").trim() || email.split("@")[0];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "password_too_short" });
  }
  const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (exists) {
    return res.status(409).json({ ok: false, error: "email_taken" });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email, scryptHash(password), displayName.slice(0, 32), now, now);
  bumpStat("register_count");
  const { token, expiresAt } = signToken(id);
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  res.json({ ok: true, token, expiresAt, user: publicUser(user) });
});

api.post("/auth/login", (req, res) => {
  const loginId = String(req.body?.email || req.body?.login || "").trim();
  const password = String(req.body?.password || "");
  if (!loginId || !password) {
    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }
  const email = loginId.toLowerCase();
  let user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  if (!user) {
    user = db
      .prepare(`SELECT * FROM users WHERE lower(display_name) = lower(?)`)
      .get(loginId);
  }
  // 兼容只填邮箱本地部分：lukeze_sw → lukeze_sw@...
  if (!user && !loginId.includes("@")) {
    user = db
      .prepare(`SELECT * FROM users WHERE lower(email) LIKE lower(?)`)
      .get(`${loginId}@%`);
  }
  if (!user || !user.password_hash || !scryptVerify(password, user.password_hash)) {
    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }
  if (user.banned) {
    return res.status(403).json({ ok: false, error: "banned" });
  }
  db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).run(Date.now(), user.id);
  const { token, expiresAt } = signToken(user.id);
  res.json({
    ok: true,
    token,
    expiresAt,
    user: publicUser({ ...user, last_login_at: Date.now() }),
  });
});

api.post("/auth/logout", authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(req.token);
  res.json({ ok: true });
});

api.get("/auth/me", authMiddleware, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user) });
});

/** 当前账号在多少台设备上登录着（每台设备一条独立 token）。 */
api.get("/auth/devices", authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT token, created_at AS createdAt, expires_at AS expiresAt
       FROM sessions WHERE user_id = ? AND expires_at > ?
       ORDER BY created_at DESC`
    )
    .all(req.user.id, Date.now());
  res.json({
    ok: true,
    current: req.token ? `${req.token.slice(0, 6)}…` : null,
    items: rows.map((row) => ({
      id: `${row.token.slice(0, 6)}…`,
      current: row.token === req.token,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    })),
  });
});

/** 退出其它设备（保留当前这台），token 泄露或换机时用。 */
api.post("/auth/devices/revoke-others", authMiddleware, (req, res) => {
  const info = db
    .prepare(`DELETE FROM sessions WHERE user_id = ? AND token <> ?`)
    .run(req.user.id, req.token || "");
  res.json({ ok: true, revoked: info.changes });
});

/**
 * DeepSeek 账号免密登录：插件在 Host 侧读到本机已登录的 DeepSeek 身份后，
 * 用共享密钥对 `accountKey|contact` 签名再发过来。首次登录自动建号，
 * 之后按 `dsh_account_id` 直接命中同一个账号。
 */
api.post("/auth/dsh", (req, res) => {
  if (!DSH_SHARED_SECRET) {
    return res.status(503).json({ ok: false, error: "dsh_login_disabled" });
  }
  const accountKey = String(req.body?.accountKey || "").trim();
  const contact = String(req.body?.contact || "").trim().toLowerCase();
  const name = String(req.body?.name || "").trim();
  const avatarUrl = String(req.body?.avatarUrl || "").trim() || null;
  const signature = String(req.body?.signature || "").trim().toLowerCase();
  if (!accountKey || accountKey.length > 128) {
    return res.status(400).json({ ok: false, error: "invalid_account" });
  }
  const expected = crypto
    .createHmac("sha256", DSH_SHARED_SECRET)
    .update(`${accountKey}|${contact}`)
    .digest("hex");
  const given = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return res.status(401).json({ ok: false, error: "bad_signature" });
  }

  const now = Date.now();
  let user = db
    .prepare(`SELECT * FROM users WHERE dsh_account_id = ?`)
    .get(accountKey);
  let created = false;

  if (!user && contact) {
    // 已有邮箱账号时直接绑定，历史成就不会丢。
    const byEmail = db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(contact);
    if (byEmail && !byEmail.dsh_account_id) {
      db.prepare(`UPDATE users SET dsh_account_id = ? WHERE id = ?`).run(
        accountKey,
        byEmail.id
      );
      user = { ...byEmail, dsh_account_id: accountKey };
    }
  }

  if (!user) {
    const id = uuidv4();
    const displayName = (name || contact.split("@")[0] || "DSH 玩家").slice(0, 32);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, avatar_url, created_at, last_login_at, dsh_account_id)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
    ).run(id, contact || null, displayName, avatarUrl, now, now, accountKey);
    bumpStat("register_count");
    user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    created = true;
  } else if (user.banned) {
    return res.status(403).json({ ok: false, error: "banned" });
  }

  db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).run(now, user.id);
  const { token, expiresAt } = signToken(user.id);
  res.json({
    ok: true,
    created,
    token,
    expiresAt,
    user: publicUser({ ...user, last_login_at: now }),
  });
});

/** Steam OpenID 登录入口（需要后续配置 Steam Web API；无 key 时返回说明） */
api.get("/auth/steam", (_req, res) => {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": STEAM_RETURN,
    "openid.realm": STEAM_REALM,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  res.redirect(`https://steamcommunity.com/openid/login?${params}`);
});

api.get("/auth/steam/callback", async (req, res) => {
  try {
    const body = new URLSearchParams({ ...req.query, "openid.mode": "check_authentication" });
    const verify = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await verify.text();
    if (!text.includes("is_valid:true")) {
      return res.status(401).send("Steam login verification failed");
    }
    const claimed = String(req.query["openid.claimed_id"] || "");
    const m = claimed.match(/\/openid\/id\/(\d+)$/);
    if (!m) return res.status(400).send("Invalid Steam identity");
    const steamId = m[1];

    let displayName = `Steam_${steamId.slice(-4)}`;
    let avatarUrl = null;
    if (STEAM_API_KEY) {
      try {
        const infoRes = await fetch(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
        );
        const info = await infoRes.json();
        const player = info?.response?.players?.[0];
        if (player) {
          displayName = player.personaname || displayName;
          avatarUrl = player.avatarfull || player.avatarmedium || null;
        }
      } catch {
        // ignore profile fetch errors
      }
    }

    let user = db.prepare(`SELECT * FROM users WHERE steam_id = ?`).get(steamId);
    const now = Date.now();
    if (!user) {
      const id = uuidv4();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, display_name, steam_id, avatar_url, created_at, last_login_at)
         VALUES (?, NULL, NULL, ?, ?, ?, ?, ?)`
      ).run(id, displayName.slice(0, 32), steamId, avatarUrl, now, now);
      bumpStat("register_count");
      bumpStat("steam_login_count");
      user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    } else {
      if (user.banned) return res.status(403).send("Account banned");
      db.prepare(
        `UPDATE users SET last_login_at = ?, display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?`
      ).run(now, displayName, avatarUrl, user.id);
      bumpStat("steam_login_count");
      user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id);
    }

    const { token } = signToken(user.id);
    // 桌面客户端通过自定义协议或轮询拿 token；网页回跳给成功页
    res.redirect(`${BASE_PATH}/auth/steam-done.html?token=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Steam login failed");
  }
});

/** 绑定 Steam 到已有邮箱账号：预留，客户端带 token 打开 /auth/steam?bind=1 */
api.post("/auth/link-steam", authMiddleware, (req, res) => {
  const steamId = String(req.body?.steamId || "").trim();
  if (!/^\d{15,20}$/.test(steamId)) {
    return res.status(400).json({ ok: false, error: "invalid_steam_id" });
  }
  const taken = db.prepare(`SELECT id FROM users WHERE steam_id = ?`).get(steamId);
  if (taken && taken.id !== req.user.id) {
    return res.status(409).json({ ok: false, error: "steam_taken" });
  }
  db.prepare(`UPDATE users SET steam_id = ? WHERE id = ?`).run(steamId, req.user.id);
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  res.json({ ok: true, user: publicUser(user) });
});

/** 同步接口额外限流：每用户 10 次/分钟 */
function syncRateLimit(req, res, next) {
  // Keyed per session token, not per user: two devices on one account must not
  // eat each other's budget.
  const key = req.token ? `sync:tok:${req.token}` : `sync:uid:${req.user?.id || "anon"}`;
  if (!rateLimit({ key, limit: 10, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }
  next();
}

api.post("/sync/achievements", authMiddleware, syncRateLimit, (req, res) => {
  const items = Array.isArray(req.body?.achievements) ? req.body.achievements : [];
  // Which install is talking. Sanitised because it lands in a primary key.
  const deviceId = String(req.body?.deviceId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);
  const upsert = db.prepare(
    `INSERT INTO achievements (user_id, achievement_id, device_id, unlocked_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, achievement_id, device_id) DO UPDATE SET
       unlocked_at = MIN(achievements.unlocked_at, excluded.unlocked_at)`
  );
  // A rebalanced catalog retires ids. `replace: true` lets a client declare
  // "this list is my whole collection" — but only for THIS device, so a second
  // machine with a smaller collection cannot delete the first one's rows.
  const replace = req.body?.replace === true;
  const tx = db.transaction((rows) => {
    const keep = new Set();
    let n = 0;
    for (const row of rows) {
      const id = String(row?.id || row?.achievementId || "").trim();
      if (!id) continue;
      const at = Number(row?.unlockedAt) || Date.now();
      // Column order is (user_id, achievement_id, device_id, unlocked_at).
      upsert.run(req.user.id, id, deviceId, at);
      keep.add(id);
      n += 1;
    }
    if (replace) {
      const existing = db
        .prepare("SELECT achievement_id FROM achievements WHERE user_id = ? AND device_id = ?")
        .all(req.user.id, deviceId);
      const drop = db.prepare(
        "DELETE FROM achievements WHERE user_id = ? AND device_id = ? AND achievement_id = ?"
      );
      for (const row of existing) {
        if (!keep.has(row.achievement_id)) drop.run(req.user.id, deviceId, row.achievement_id);
      }
    }
    return n;
  });
  const synced = tx(items);
  bumpStat("achievement_sync_count", synced);
  const total = db
    .prepare("SELECT COUNT(DISTINCT achievement_id) AS c FROM achievements WHERE user_id = ?")
    .get(req.user.id).c;
  res.json({ ok: true, synced, deviceId, total });
});

api.post("/sync/scores", authMiddleware, syncRateLimit, (req, res) => {
  const items = Array.isArray(req.body?.scores) ? req.body.scores : [];
  const upsert = db.prepare(
    `INSERT INTO minigame_scores
      (user_id, achievement_id, game_id, best_score, best_time_ms, best_stars, play_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, achievement_id, game_id) DO UPDATE SET
       best_score = MAX(minigame_scores.best_score, excluded.best_score),
       best_time_ms = CASE
         WHEN excluded.best_time_ms IS NULL THEN minigame_scores.best_time_ms
         WHEN minigame_scores.best_time_ms IS NULL THEN excluded.best_time_ms
         ELSE MIN(minigame_scores.best_time_ms, excluded.best_time_ms)
       END,
       best_stars = MAX(minigame_scores.best_stars, excluded.best_stars),
       play_count = MAX(minigame_scores.play_count, excluded.play_count),
       updated_at = excluded.updated_at`
  );
  const tx = db.transaction((rows) => {
    let n = 0;
    for (const row of rows) {
      const achievementId = String(row?.achievementId || "").trim();
      const gameId = String(row?.gameId || "").trim();
      if (!achievementId || !gameId) continue;
      upsert.run(
        req.user.id,
        achievementId,
        gameId,
        Number(row?.bestScore) || 0,
        row?.bestTimeMs == null ? null : Number(row.bestTimeMs) || null,
        Math.max(0, Math.min(3, Number(row?.bestStars) || 0)),
        Math.max(0, Number(row?.playCount) || 0),
        Number(row?.updatedAt) || Date.now()
      );
      n += 1;
    }
    return n;
  });
  const synced = tx(items);
  bumpStat("score_sync_count", synced);
  res.json({ ok: true, synced });
});

api.get("/sync/pull", authMiddleware, syncRateLimit, (req, res) => {
  const achievements = db
    .prepare(
      `SELECT achievement_id AS id, MIN(unlocked_at) AS unlockedAt
       FROM achievements WHERE user_id = ?
       GROUP BY achievement_id ORDER BY unlockedAt`
    )
    .all(req.user.id);
  const scores = db
    .prepare(
      `SELECT achievement_id AS achievementId, game_id AS gameId,
              best_score AS bestScore, best_time_ms AS bestTimeMs,
              best_stars AS bestStars, play_count AS playCount,
              updated_at AS updatedAt
       FROM minigame_scores WHERE user_id = ?`
    )
    .all(req.user.id);
  const u = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  res.json({
    ok: true,
    achievements,
    scores,
    statsEpochMs: u?.stats_epoch_ms ?? null,
    progress: parseProgress(u?.progress_json),
    progressUpdatedAt: u?.progress_updated_at ?? null,
  });
});

/**
 * 开启/对齐赛季：若账号尚无 stats_epoch_ms 则写入；已有则原样返回。
 * body.statsEpochMs 可选（客户端建议传 now）。
 */
api.post("/sync/season", authMiddleware, syncRateLimit, (req, res) => {
  const u = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  if (!u) return res.status(404).json({ ok: false, error: "not_found" });
  let epoch = u.stats_epoch_ms ?? null;
  let created = false;
  if (epoch == null) {
    epoch = Number(req.body?.statsEpochMs) || Date.now();
    const progress = emptyProgress();
    const now = Date.now();
    db.prepare(
      `UPDATE users SET stats_epoch_ms = ?, progress_json = ?, progress_updated_at = ? WHERE id = ?`
    ).run(epoch, JSON.stringify(progress), now, req.user.id);
    created = true;
    bumpStat("season_start_count");
  }
  const next = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  res.json({
    ok: true,
    created,
    statsEpochMs: next.stats_epoch_ms,
    progress: parseProgress(next.progress_json),
    progressUpdatedAt: next.progress_updated_at ?? null,
    user: publicUser(next),
  });
});

/** 进度快照：与云端字段级 MAX 合并后写回 */
api.post("/sync/progress", authMiddleware, syncRateLimit, (req, res) => {
  const u = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  if (!u) return res.status(404).json({ ok: false, error: "not_found" });
  if (u.stats_epoch_ms == null) {
    return res.status(400).json({ ok: false, error: "season_not_started" });
  }
  const merged = mergeProgress(u.progress_json, req.body?.progress);
  const now = Date.now();
  db.prepare(
    `UPDATE users SET progress_json = ?, progress_updated_at = ? WHERE id = ?`
  ).run(JSON.stringify(merged), now, req.user.id);
  bumpStat("progress_sync_count");
  res.json({
    ok: true,
    progress: merged,
    progressUpdatedAt: now,
    statsEpochMs: u.stats_epoch_ms,
  });
});

api.get("/leaderboard/achievements", (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_url AS avatarUrl,
              COUNT(DISTINCT a.achievement_id) AS achievementCount,
              MAX(a.unlocked_at) AS lastUnlockAt
       FROM users u
       JOIN achievements a ON a.user_id = u.id
       WHERE u.banned = 0
       GROUP BY u.id
       ORDER BY achievementCount DESC, lastUnlockAt ASC
       LIMIT ?`
    )
    .all(limit);
  res.json({
    ok: true,
    items: rows.map((r, i) => ({ rank: i + 1, ...r })),
  });
});

/**
 * Every board reads one monotonic scalar. `achievements` and `season` are
 * counted from the achievements table, the rest from the synced progress blob.
 */
const BOARDS = {
  achievements: { field: "achievementCount", label: "成就数", unit: "枚" },
  season: { field: "achievementCount", label: "赛季成就", unit: "枚", season: true },
  points: { field: "points", label: "积分", unit: "分", json: "$.points" },
  level: { field: "level", label: "等级", unit: "级", json: "$.level" },
  tokens: { field: "totalTokens", label: "累计 Token", unit: "", json: "$.totalTokens" },
  sessions: { field: "totalSessions", label: "会话数", unit: "局", json: "$.totalSessions" },
  streak: { field: "maxStreak", label: "连续天数", unit: "天", json: "$.maxStreak" },
  days: { field: "activeDays", label: "活跃天数", unit: "天", json: "$.activeDays" },
  tools: { field: "toolCalls", label: "工具调用", unit: "次", json: "$.toolCalls" },
  code: { field: "codeBlocks", label: "代码块", unit: "个", json: "$.codeBlocks" },
  today: { field: "todayTokens", label: "今日 Token", unit: "", json: "$.todayTokens" },
};

api.get("/leaderboard", (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit({ key: `lb:${ip}`, limit: 120, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const kind = String(req.query.kind || "achievements");
  const board = BOARDS[kind] || BOARDS.achievements;

  let rows;
  if (board.season) {
    rows = db
      .prepare(
        `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_url AS avatarUrl,
                COUNT(DISTINCT a.achievement_id) AS achievementCount,
                MAX(a.unlocked_at) AS lastUnlockAt,
                COALESCE(json_extract(u.progress_json, '$.level'), 1) AS level
         FROM users u
         JOIN achievements a ON a.user_id = u.id AND a.unlocked_at >= COALESCE(u.stats_epoch_ms, 0)
         WHERE u.banned = 0
         GROUP BY u.id
         ORDER BY achievementCount DESC, lastUnlockAt ASC
         LIMIT ?`
      )
      .all(limit);
  } else if (kind === "achievements") {
    rows = db
      .prepare(
        `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_url AS avatarUrl,
                COUNT(DISTINCT a.achievement_id) AS achievementCount,
                MAX(a.unlocked_at) AS lastUnlockAt,
                COALESCE(json_extract(u.progress_json, '$.level'), 1) AS level
         FROM users u
         JOIN achievements a ON a.user_id = u.id
         WHERE u.banned = 0
         GROUP BY u.id
         ORDER BY achievementCount DESC, lastUnlockAt ASC
         LIMIT ?`
      )
      .all(limit);
  } else {
    const expr = `COALESCE(json_extract(u.progress_json, '${board.json}'), 0)`;
    rows = db
      .prepare(
        `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_url AS avatarUrl,
                ${expr} AS value,
                COALESCE(json_extract(u.progress_json, '$.level'), 1) AS level,
                (SELECT COUNT(DISTINCT a.achievement_id) FROM achievements a WHERE a.user_id = u.id) AS achievementCount
         FROM users u
         WHERE u.banned = 0
         ORDER BY value DESC, achievementCount DESC, u.last_login_at ASC
         LIMIT ?`
      )
      .all(limit);
  }

  res.json({
    ok: true,
    kind,
    label: board.label,
    unit: board.unit,
    items: rows.map((r, i) => ({
      rank: i + 1,
      ...r,
      value: board.season || kind === "achievements" ? r.achievementCount : Number(r.value) || 0,
    })),
  });
});

api.get("/leaderboard/minigame/:achievementId", (req, res) => {
  const achievementId = String(req.params.achievementId || "").trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_url AS avatarUrl,
              s.game_id AS gameId, s.best_score AS bestScore,
              s.best_time_ms AS bestTimeMs, s.best_stars AS bestStars,
              s.updated_at AS updatedAt
       FROM minigame_scores s
       JOIN users u ON u.id = s.user_id
       WHERE s.achievement_id = ? AND u.banned = 0 AND s.best_score > 0
       ORDER BY s.best_score DESC,
                CASE WHEN s.best_time_ms IS NULL THEN 1 ELSE 0 END,
                s.best_time_ms ASC,
                s.updated_at ASC
       LIMIT ?`
    )
    .all(achievementId, limit);
  res.json({
    ok: true,
    achievementId,
    items: rows.map((r, i) => ({ rank: i + 1, ...r })),
  });
});

api.get("/leaderboard/minigames", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT achievement_id AS achievementId, COUNT(*) AS entries,
              MAX(best_score) AS topScore
       FROM minigame_scores
       WHERE best_score > 0
       GROUP BY achievement_id
       ORDER BY entries DESC
       LIMIT 200`
    )
    .all();
  res.json({ ok: true, items: rows });
});

api.get("/stats/public", (_req, res) => {
  const users = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE banned = 0`).get().c;
  const achievements = db
    .prepare(`SELECT COUNT(*) AS c FROM (SELECT DISTINCT user_id, achievement_id FROM achievements)`)
    .get().c;
  const scores = db.prepare(`SELECT COUNT(*) AS c FROM minigame_scores`).get().c;
  res.json({ ok: true, users, achievements, scores });
});

/** —— Admin —— */
function adminUserRowSelect() {
  return `SELECT id, email, display_name AS displayName, steam_id AS steamId,
                  avatar_url AS avatarUrl,
                  created_at AS createdAt, last_login_at AS lastLoginAt, banned,
                  stats_epoch_ms AS statsEpochMs,
                  progress_json AS progressJson,
                  progress_updated_at AS progressUpdatedAt,
                  (SELECT COUNT(DISTINCT a.achievement_id) FROM achievements a WHERE a.user_id = users.id) AS achievementCount,
                  (SELECT COUNT(*) FROM minigame_scores s WHERE s.user_id = users.id) AS scoreCount,
                  (SELECT COUNT(*) FROM sessions s WHERE s.user_id = users.id AND s.expires_at > ?) AS activeSessionCount
           FROM users`;
}

function mapAdminUser(row) {
  const progress = parseProgress(row.progressJson);
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    steamId: row.steamId,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    banned: !!row.banned,
    statsEpochMs: row.statsEpochMs ?? null,
    progressUpdatedAt: row.progressUpdatedAt ?? null,
    progress,
    achievementCount: row.achievementCount ?? 0,
    scoreCount: row.scoreCount ?? 0,
    activeSessionCount: row.activeSessionCount ?? 0,
  };
}

api.get("/admin/overview", adminMiddleware, (_req, res) => {
  const users = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
  const activeUsers = db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE last_login_at > ?`)
    .get(Date.now() - 7 * 24 * 3600 * 1000).c;
  const banned = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE banned = 1`).get().c;
  const achievements = db
    .prepare(`SELECT COUNT(*) AS c FROM (SELECT DISTINCT user_id, achievement_id FROM achievements)`)
    .get().c;
  const scores = db.prepare(`SELECT COUNT(*) AS c FROM minigame_scores`).get().c;
  const sessions = db
    .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE expires_at > ?`)
    .get(Date.now()).c;
  const withSeason = db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE stats_epoch_ms IS NOT NULL`)
    .get().c;
  const meta = Object.fromEntries(
    db.prepare(`SELECT key, value FROM meta`).all().map((r) => [r.key, r.value])
  );
  const recent = db
    .prepare(
      `${adminUserRowSelect()} ORDER BY created_at DESC LIMIT 20`
    )
    .all(Date.now())
    .map(mapAdminUser);
  res.json({
    ok: true,
    overview: {
      users,
      activeUsers,
      banned,
      achievements,
      scores,
      sessions,
      withSeason,
      meta,
    },
    recentUsers: recent,
  });
});

api.get("/admin/users", adminMiddleware, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const now = Date.now();
  let rows;
  let total;
  if (q) {
    const like = `%${q}%`;
    total = db
      .prepare(
        `SELECT COUNT(*) AS c FROM users
         WHERE lower(COALESCE(email,'')) LIKE ? OR lower(display_name) LIKE ?
            OR COALESCE(steam_id,'') LIKE ? OR id LIKE ?`
      )
      .get(like, like, like, like).c;
    rows = db
      .prepare(
        `${adminUserRowSelect()}
         WHERE lower(COALESCE(email,'')) LIKE ? OR lower(display_name) LIKE ?
            OR COALESCE(steam_id,'') LIKE ? OR id LIKE ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(now, like, like, like, like, limit, offset);
  } else {
    total = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
    rows = db
      .prepare(
        `${adminUserRowSelect()} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(now, limit, offset);
  }
  res.json({
    ok: true,
    total,
    limit,
    offset,
    users: rows.map(mapAdminUser),
  });
});

api.get("/admin/users/:id", adminMiddleware, (req, res) => {
  const now = Date.now();
  const raw = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
  if (!raw) return res.status(404).json({ ok: false, error: "not_found" });

  const row = db
    .prepare(`${adminUserRowSelect()} WHERE id = ?`)
    .get(now, req.params.id);
  const user = mapAdminUser(row);
  user.hasPassword = !!(raw.password_hash && String(raw.password_hash).length > 0);
  user.passwordHashAlgo = user.hasPassword
    ? String(raw.password_hash).includes(":")
      ? "scrypt"
      : "unknown"
    : null;
  user.progressRaw = raw.progress_json ?? null;
  user.progressRawParsed = (() => {
    if (!raw.progress_json) return null;
    try {
      return JSON.parse(raw.progress_json);
    } catch {
      return { _parseError: true, raw: raw.progress_json };
    }
  })();

  const achievements = db
    .prepare(
      `SELECT achievement_id AS id, MIN(unlocked_at) AS unlockedAt
       FROM achievements WHERE user_id = ?
       GROUP BY achievement_id ORDER BY unlockedAt ASC`
    )
    .all(req.params.id);

  const scores = db
    .prepare(
      `SELECT achievement_id AS achievementId, game_id AS gameId,
              best_score AS bestScore, best_time_ms AS bestTimeMs,
              best_stars AS bestStars, play_count AS playCount,
              updated_at AS updatedAt
       FROM minigame_scores WHERE user_id = ? ORDER BY achievement_id ASC, game_id ASC`
    )
    .all(req.params.id);

  const sessionTotal = db
    .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?`)
    .get(req.params.id).c;
  const sessionActive = db
    .prepare(
      `SELECT COUNT(*) AS c FROM sessions WHERE user_id = ? AND expires_at > ?`
    )
    .get(req.params.id, now).c;
  const sessions = db
    .prepare(
      `SELECT substr(token,1,12) AS tokenPrefix, length(token) AS tokenLen,
              created_at AS createdAt, expires_at AS expiresAt,
              CASE WHEN expires_at > ? THEN 1 ELSE 0 END AS active
       FROM sessions WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(now, req.params.id);

  const scoreByAchievement = {};
  for (const s of scores) {
    const k = s.achievementId;
    if (!scoreByAchievement[k]) {
      scoreByAchievement[k] = { achievementId: k, games: 0, bestScore: 0, playCount: 0 };
    }
    scoreByAchievement[k].games += 1;
    scoreByAchievement[k].bestScore = Math.max(
      scoreByAchievement[k].bestScore,
      Number(s.bestScore) || 0
    );
    scoreByAchievement[k].playCount += Number(s.playCount) || 0;
  }

  const dump = {
    exportedAt: now,
    user: {
      id: raw.id,
      email: raw.email,
      displayName: raw.display_name,
      steamId: raw.steam_id,
      avatarUrl: raw.avatar_url,
      createdAt: raw.created_at,
      lastLoginAt: raw.last_login_at,
      banned: !!raw.banned,
      hasPassword: user.hasPassword,
      passwordHashAlgo: user.passwordHashAlgo,
      statsEpochMs: raw.stats_epoch_ms,
      progressUpdatedAt: raw.progress_updated_at,
      progressJson: raw.progress_json,
      progress: user.progress,
    },
    achievements,
    scores,
    sessions: sessions.map((s) => ({
      tokenPrefix: s.tokenPrefix,
      tokenLen: s.tokenLen,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      active: !!s.active,
    })),
    counts: {
      achievements: achievements.length,
      scores: scores.length,
      sessionsTotal: sessionTotal,
      sessionsActive: sessionActive,
      scoreAchievements: Object.keys(scoreByAchievement).length,
    },
  };

  res.json({
    ok: true,
    user,
    achievements,
    scores,
    sessions,
    scoreByAchievement: Object.values(scoreByAchievement),
    counts: dump.counts,
    dump,
  });
});

/** 下载账号全量 JSON（不含密码哈希） */
api.get("/admin/users/:id/export", adminMiddleware, (req, res) => {
  const now = Date.now();
  const raw = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
  if (!raw) return res.status(404).json({ ok: false, error: "not_found" });
  const achievements = db
    .prepare(
      `SELECT achievement_id AS id, MIN(unlocked_at) AS unlockedAt
       FROM achievements WHERE user_id = ?
       GROUP BY achievement_id ORDER BY unlockedAt ASC`
    )
    .all(req.params.id);
  const scores = db
    .prepare(
      `SELECT achievement_id AS achievementId, game_id AS gameId,
              best_score AS bestScore, best_time_ms AS bestTimeMs,
              best_stars AS bestStars, play_count AS playCount,
              updated_at AS updatedAt
       FROM minigame_scores WHERE user_id = ? ORDER BY achievement_id ASC, game_id ASC`
    )
    .all(req.params.id);
  const sessions = db
    .prepare(
      `SELECT substr(token,1,12) AS tokenPrefix, length(token) AS tokenLen,
              created_at AS createdAt, expires_at AS expiresAt,
              CASE WHEN expires_at > ? THEN 1 ELSE 0 END AS active
       FROM sessions WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(now, req.params.id);
  const payload = {
    exportedAt: now,
    user: {
      id: raw.id,
      email: raw.email,
      displayName: raw.display_name,
      steamId: raw.steam_id,
      avatarUrl: raw.avatar_url,
      createdAt: raw.created_at,
      lastLoginAt: raw.last_login_at,
      banned: !!raw.banned,
      hasPassword: !!(raw.password_hash && String(raw.password_hash).length > 0),
      statsEpochMs: raw.stats_epoch_ms,
      progressUpdatedAt: raw.progress_updated_at,
      progressJson: raw.progress_json,
      progress: parseProgress(raw.progress_json),
    },
    achievements,
    scores,
    sessions: sessions.map((s) => ({
      tokenPrefix: s.tokenPrefix,
      tokenLen: s.tokenLen,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      active: !!s.active,
    })),
  };
  const filename = `codequest-user-${raw.id}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
});

api.post("/admin/users/:id/ban", adminMiddleware, (req, res) => {
  const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
  const banned = req.body?.banned ? 1 : 0;
  db.prepare(`UPDATE users SET banned = ? WHERE id = ?`).run(banned, req.params.id);
  if (banned) db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(req.params.id);
  res.json({ ok: true, banned: !!banned });
});

/** 清理赛季：清空 epoch + progress，客户端下次登录会重开赛季 */
api.post("/admin/users/:id/clear-season", adminMiddleware, (req, res) => {
  const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
  db.prepare(
    `UPDATE users SET stats_epoch_ms = NULL, progress_json = NULL, progress_updated_at = NULL WHERE id = ?`
  ).run(req.params.id);
  res.json({ ok: true, cleared: "season" });
});

api.post("/admin/users/:id/clear-achievements", adminMiddleware, (req, res) => {
  const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
  const info = db.prepare(`DELETE FROM achievements WHERE user_id = ?`).run(req.params.id);
  res.json({ ok: true, cleared: "achievements", deleted: info.changes });
});

api.post("/admin/users/:id/clear-scores", adminMiddleware, (req, res) => {
  const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
  const info = db.prepare(`DELETE FROM minigame_scores WHERE user_id = ?`).run(req.params.id);
  res.json({ ok: true, cleared: "scores", deleted: info.changes });
});

api.post("/admin/users/:id/clear-sessions", adminMiddleware, (req, res) => {
  const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
  const info = db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(req.params.id);
  res.json({ ok: true, cleared: "sessions", deleted: info.changes });
});

/** 临时：清账号关联数据但保留注册账号（赛季+成就+分数+登录会话） */
api.post("/admin/users/:id/clear-data", adminMiddleware, (req, res) => {
  const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
  const tx = db.transaction((uid) => {
    const ach = db.prepare(`DELETE FROM achievements WHERE user_id = ?`).run(uid).changes;
    const scores = db.prepare(`DELETE FROM minigame_scores WHERE user_id = ?`).run(uid).changes;
    const sessions = db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(uid).changes;
    db.prepare(
      `UPDATE users SET stats_epoch_ms = NULL, progress_json = NULL, progress_updated_at = NULL WHERE id = ?`
    ).run(uid);
    return { ach, scores, sessions };
  });
  const deleted = tx(req.params.id);
  res.json({ ok: true, cleared: "data", deleted });
});

/** 重置密码：至少 6 位；会踢掉该用户全部登录会话 */
api.post("/admin/users/:id/reset-password", adminMiddleware, (req, res) => {
  const user = db.prepare(`SELECT id, email, display_name FROM users WHERE id = ?`).get(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: "not_found" });
  let password = String(req.body?.password || "").trim();
  if (!password) {
    password = crypto.randomBytes(4).toString("hex") + "Aa1!";
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "password_too_short" });
  }
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    scryptHash(password),
    req.params.id
  );
  const kicked = db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(req.params.id).changes;
  res.json({
    ok: true,
    reset: true,
    password,
    kickedSessions: kicked,
    email: user.email,
    displayName: user.display_name,
  });
});

api.delete("/admin/users/:id", adminMiddleware, (req, res) => {
  const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
  // FK CASCADE 会清 achievements / scores / sessions
  db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
  res.json({ ok: true, deleted: true });
});

api.get("/admin/leaderboard/achievements", adminMiddleware, (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.display_name AS displayName, u.email,
              COUNT(DISTINCT a.achievement_id) AS achievementCount
       FROM users u JOIN achievements a ON a.user_id = u.id
       GROUP BY u.id ORDER BY achievementCount DESC LIMIT ?`
    )
    .all(limit);
  res.json({ ok: true, items: rows });
});

app.use(`${BASE_PATH}/api`, api);
app.use(`${BASE_PATH}/admin`, express.static(path.join(__dirname, "admin")));
app.use(
  `${BASE_PATH}/auth`,
  express.static(path.join(__dirname, "public-auth"))
);
app.use(BASE_PATH || "/", express.static(path.join(__dirname, "admin")));

// 兼容：直接挂在根路径调试
app.use("/api", api);
app.use("/admin", express.static(path.join(__dirname, "admin")));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[codequest] listening on http://127.0.0.1:${PORT}${BASE_PATH}`);
  console.log(`[codequest] admin: ${BASE_PATH}/admin/  user=${ADMIN_USER}`);
});


