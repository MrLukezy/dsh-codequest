import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import { foldSession, aggregate } from '../scan.js';
import { evaluate } from '../achievements.js';

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

function readSession(file) {
  const parts = [];
  for (const frame of frames(fs.readFileSync(file))) {
    try {
      parts.push(zlib.zstdDecompressSync(frame));
    } catch {
      parts.push(Buffer.from(''));
    }
  }
  const events = [];
  let header = null;
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

const root = process.argv[2];
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.zstd')) files.push(full);
  }
})(root);

const sessions = {};
let failed = 0;
for (const file of files) {
  try {
    const { header, events } = readSession(file);
    if (!header) continue;
    sessions[header.id] = { fold: foldSession(header, events) };
  } catch {
    failed += 1;
  }
}

const m = aggregate(sessions);
const ev = evaluate(m, {});
console.log(JSON.stringify({
  sessions: Object.keys(sessions).length,
  failed,
  tokens: m.tokens,
  promptChars: m.promptChars,
  assistantChars: m.assistantChars,
  codeBlocks: m.codeBlocks,
  night: m.nightSessions,
  early: m.earlySessions,
  weekend: m.weekendSessions,
  activeDays: m.activeDays,
  sentiment: m.sentiment,
  tools: m.distinctTools,
  models: Object.keys(m.models),
  points: ev.points,
  level: ev.level,
  unlocked: ev.items.filter((i) => i.unlockedAt).length,
  top: ev.items.filter((i) => i.unlockedAt).slice(0, 8).map((i) => i.name),
}, null, 2));
