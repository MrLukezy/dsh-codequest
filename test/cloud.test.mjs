/**
 * Wire-format test for the cloud client: the Host must tell the server which
 * device it is, otherwise the per-device usage rows and the account total can
 * not be built. Uses a local HTTP stub, no real server needed.
 *
 * Run: node test/cloud.test.mjs
 */
import http from 'node:http';

import { CloudClient, progressFromMetrics } from '../cloud.js';

const calls = [];
const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    calls.push({ path: req.url, method: req.method, body: raw ? JSON.parse(raw) : null });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, token: 'tok', progress: {} }));
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = new CloudClient(base);

  await client.login('a@b.c', 'pw', 'dev1', 'Windows · x64');
  await client.register('a@b.c', 'pw', 'Name', 'dev1', 'Windows · x64');
  await client.syncAchievements([{ id: 'x', unlockedAt: 1 }], true, 'dev1', 'Windows · x64');
  await client.syncProgress(
    progressFromMetrics({ tokens: 10, sessions: 1 }, { points: 1, level: 1 }),
    'dev1',
    'Windows · x64',
  );
  // Old callers without a device still work and simply omit the fields.
  await client.syncProgress(progressFromMetrics({ tokens: 1 }, { points: 0, level: 1 }));
  await client.dshLogin({ accountKey: 'k', signature: 's', deviceId: 'dev1', deviceLabel: 'Windows · x64' });

  const [login, register, achievements, progress, legacy, dsh] = calls;

  assert(login.path === '/auth/login', `unexpected login path ${login.path}`);
  assert(login.body.deviceId === 'dev1', 'login must carry deviceId');
  assert(login.body.deviceLabel === 'Windows · x64', 'login must carry deviceLabel');

  assert(register.body.deviceId === 'dev1', 'register must carry deviceId');
  assert(register.body.deviceLabel === 'Windows · x64', 'register must carry deviceLabel');

  assert(achievements.path === '/sync/achievements', `unexpected achievements path ${achievements.path}`);
  assert(achievements.body.deviceId === 'dev1', 'achievement sync must carry deviceId');
  assert(achievements.body.deviceLabel === 'Windows · x64', 'achievement sync must carry deviceLabel');
  assert(achievements.body.replace === true, 'replace flag must survive');

  assert(progress.path === '/sync/progress', `unexpected progress path ${progress.path}`);
  assert(progress.body.deviceId === 'dev1', 'progress sync must carry deviceId');
  assert(progress.body.deviceLabel === 'Windows · x64', 'progress sync must carry deviceLabel');
  assert(progress.body.progress.totalTokens === 10, 'progress payload must survive');

  assert(legacy.body.deviceId === '', 'a caller without a device should send an empty id');
  assert(legacy.body.deviceLabel === '', 'a caller without a device should send an empty label');

  assert(dsh.path === '/auth/dsh', `unexpected dsh path ${dsh.path}`);
  assert(dsh.body.deviceId === 'dev1', 'dsh login must forward deviceId');

  console.log('cloud client device payloads: ok');
} finally {
  await new Promise((resolve) => server.close(resolve));
}