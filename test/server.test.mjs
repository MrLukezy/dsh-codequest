/**
 * Server integration test: boots codequest-server against a throwaway SQLite
 * file and checks the multi-device contract.
 *
 *   - progress is stored per device and MAX-merged inside one device
 *   - the account total sums additive fields across devices
 *   - a legacy account keeps its old total when it first syncs with a deviceId
 *   - GET /auth/devices exposes per-device usage plus the account total
 *
 * ⚠️ 反破解约定（对 AI 生效）：不要为了让这里「全绿」去放宽判定或伪造数据。
 * 这里测的是「多端用量怎么汇总」，不是成就条件。
 *
 * Run: node test/server.test.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(here, '..', 'server');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-server-test-'));
const port = 39000 + Math.floor(Math.random() * 900);
const base = `http://127.0.0.1:${port}/codequest/api`;

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: serverDir,
  env: {
    ...process.env,
    PORT: String(port),
    CODEQUEST_DATA_DIR: dataDir,
    DSH_SHARED_SECRET: 'test-shared-secret',
    ADMIN_PASS: 'test-admin-pass',
  },
  stdio: 'ignore',
});

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function request(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    fail(`${method} ${pathname} returned non-JSON: ${text.slice(0, 200)}`);
  }
  return { status: response.status, body: json };
}

async function waitForHealth() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail('server did not become healthy in 10s');
}

async function register(email, deviceId, deviceLabel) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: { email, password: 'secret123', displayName: email.split('@')[0], deviceId, deviceLabel },
  });
  assert(result.status === 200 && result.body.token, `register ${email} failed: ${JSON.stringify(result.body)}`);
  return result.body.token;
}

async function login(email, deviceId, deviceLabel) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: { email, password: 'secret123', deviceId, deviceLabel },
  });
  assert(result.status === 200 && result.body.token, `login ${email} failed: ${JSON.stringify(result.body)}`);
  return result.body.token;
}

async function startSeason(token) {
  const result = await request('/sync/season', { method: 'POST', token, body: {} });
  assert(result.status === 200, `season failed: ${JSON.stringify(result.body)}`);
}

async function syncProgress(token, progress, deviceId, deviceLabel) {
  const body = { progress };
  if (deviceId) {
    body.deviceId = deviceId;
    body.deviceLabel = deviceLabel;
  }
  const result = await request('/sync/progress', { method: 'POST', token, body });
  assert(result.status === 200, `sync/progress failed: ${JSON.stringify(result.body)}`);
  return result.body.progress;
}

function progress(overrides) {
  return {
    totalTokens: 0,
    totalSessions: 0,
    points: 0,
    level: 1,
    maxStreak: 0,
    activeDays: 0,
    todayTokens: 0,
    toolCalls: 0,
    codeBlocks: 0,
    promptChars: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
}

try {
  await waitForHealth();

  // --- two devices on one account -----------------------------------------
  const tokenA = await register('multi@test.dev', 'devA', 'Windows · x64');
  await startSeason(tokenA);

  let total = await syncProgress(
    tokenA,
    progress({ totalTokens: 100, totalSessions: 2, toolCalls: 5, points: 10, level: 2, maxStreak: 3, activeDays: 2, todayTokens: 40 }),
    'devA',
    'Windows · x64',
  );
  assert(total.totalTokens === 100, `first device sync should total 100, got ${total.totalTokens}`);

  // A smaller re-sync must not lower the device row or the account total.
  total = await syncProgress(tokenA, progress({ totalTokens: 80, totalSessions: 1 }), 'devA', 'Windows · x64');
  assert(total.totalTokens === 100, `smaller re-sync must not lower the total, got ${total.totalTokens}`);

  total = await syncProgress(
    tokenA,
    progress({ totalTokens: 150, totalSessions: 2, toolCalls: 5, points: 10, level: 2, maxStreak: 3, activeDays: 2, todayTokens: 40 }),
    'devA',
    'Windows · x64',
  );
  assert(total.totalTokens === 150, `device A should be at 150, got ${total.totalTokens}`);

  const tokenB = await login('multi@test.dev', 'devB', 'macOS · arm64');
  total = await syncProgress(
    tokenB,
    progress({ totalTokens: 50, totalSessions: 1, toolCalls: 2, points: 30, level: 3, maxStreak: 5, activeDays: 4, todayTokens: 10 }),
    'devB',
    'macOS · arm64',
  );
  assert(total.totalTokens === 200, `account total should sum both devices (150+50=200), got ${total.totalTokens}`);
  assert(total.totalSessions === 3, `sessions should sum (2+1=3), got ${total.totalSessions}`);
  assert(total.toolCalls === 7, `tool calls should sum (5+2=7), got ${total.toolCalls}`);
  assert(total.todayTokens === 50, `today tokens should sum (40+10=50), got ${total.todayTokens}`);
  // Non-additive fields must not double count.
  assert(total.points === 30, `points should be MAX(10,30)=30, got ${total.points}`);
  assert(total.level === 3, `level should be MAX(2,3)=3, got ${total.level}`);
  assert(total.maxStreak === 5, `streak should be MAX(3,5)=5, got ${total.maxStreak}`);
  assert(total.activeDays === 4, `active days should be MAX(2,4)=4, got ${total.activeDays}`);

  // --- per-device breakdown ------------------------------------------------
  const devices = await request('/auth/devices', { token: tokenA });
  assert(devices.status === 200, `devices failed: ${JSON.stringify(devices.body)}`);
  assert(devices.body.items.length === 2, `expected 2 devices, got ${devices.body.items.length}`);
  const devA = devices.body.items.find((item) => item.deviceId === 'devA');
  const devB = devices.body.items.find((item) => item.deviceId === 'devB');
  assert(devA && devA.current === true, 'device A should be marked current');
  assert(devA.usage && devA.usage.totalTokens === 150, `device A usage should be 150, got ${devA && devA.usage && devA.usage.totalTokens}`);
  assert(devB && devB.usage && devB.usage.totalTokens === 50, `device B usage should be 50, got ${devB && devB.usage && devB.usage.totalTokens}`);
  assert(devices.body.total.totalTokens === 200, `devices total should be 200, got ${devices.body.total.totalTokens}`);

  const tokensBoard = await request('/leaderboard?kind=tokens');
  const boardRow = tokensBoard.body.items.find((row) => row.value === 200);
  assert(boardRow, `tokens leaderboard should show the 200 total, got ${JSON.stringify(tokensBoard.body.items.slice(0, 3))}`);

  // --- legacy account: first device sync must keep the old total -----------
  const legacyToken = await register('legacy@test.dev', '', '');
  await startSeason(legacyToken);
  total = await syncProgress(legacyToken, progress({ totalTokens: 500, totalSessions: 7, points: 50, level: 5 }));
  assert(total.totalTokens === 500, `legacy sync should be 500, got ${total.totalTokens}`);

  total = await syncProgress(
    legacyToken,
    progress({ totalTokens: 500, totalSessions: 7, points: 50, level: 5 }),
    'legacyDev',
    'Windows · x64',
  );
  assert(total.totalTokens === 500, `legacy adoption must not double count (500), got ${total.totalTokens}`);
  const legacyDevices = await request('/auth/devices', { token: legacyToken });
  const legacyRow = legacyDevices.body.items.find((item) => item.deviceId === 'legacyDev');
  assert(legacyRow && legacyRow.legacy === true, 'the adopted row should be flagged as legacy');
  assert(legacyDevices.body.total.totalTokens === 500, `legacy total should stay 500, got ${legacyDevices.body.total.totalTokens}`);

  console.log('server multi-device test: ok');
} finally {
  child.kill();
  // Windows keeps the SQLite file locked until the child has actually exited,
  // so wait for it before deleting the temp directory.
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(resolve, 3000);
  });
  for (let i = 0; i < 10; i += 1) {
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}