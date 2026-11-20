/**
 * Daily report test.
 *
 * The report is computed from the day-bucketed fields of `/state` (tokens,
 * sessions, prompts) plus achievement unlock times, so it must be deterministic
 * for a given day and never depend on when it is opened. This test pins:
 *   - local day keys and month/year boundaries
 *   - the numbers, the 7-day comparison, the streak and the unlock list
 *   - "show yesterday's digest once per day" (including the midnight case)
 *   - the DailyTab render path
 *
 * Run: node test/daily.test.mjs
 */
let captured = null;
const storage = new Map();

globalThis.window = {
  __ModuleLoader__: { load: (entry) => (captured = entry) },
  location: { pathname: '/dsh/' },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

const noop = () => {};
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, noop],
  useEffect: noop,
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useRef: (initial) => ({ current: initial }),
  Fragment: 'fragment',
};

await import('../client.js');
const mod = captured.factory((name) => {
  if (name === 'react') return fakeReact;
  throw new Error(`unexpected module request: ${name}`);
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const daily = mod.__daily;
assert(daily && typeof daily.build === 'function', 'missing __daily seam');

// Local date keys: build fixtures through local noon so the test never depends
// on the machine's timezone.
const dayKey = (y, m, d) => daily.dayKeyOf(new Date(y, m - 1, d, 12, 0, 0).getTime());
const at = (y, m, d, hour = 12) => new Date(y, m - 1, d, hour, 0, 0).getTime();

// --- day keys -------------------------------------------------------------
assert(daily.shiftDayKey('2026-03-01', -1) === '2026-02-28', 'month boundary');
assert(daily.shiftDayKey('2028-03-01', -1) === '2028-02-29', 'leap day boundary');
assert(daily.shiftDayKey('2026-12-31', 1) === '2027-01-01', 'year boundary');
assert(daily.shiftDayKey('2026-11-19', 0) === '2026-11-19', 'zero shift');
assert(daily.dayKeyOf(at(2026, 11, 19)) === '2026-11-19', 'local day key');

// --- one day of data ------------------------------------------------------
const yesterday = '2026-11-19';
const data = {
  stats: {
    dailyTokens: {
      '2026-11-13': 1000,
      '2026-11-14': 0,
      '2026-11-15': 2000,
      '2026-11-16': 500,
      '2026-11-17': 800,
      '2026-11-18': 700,
      '2026-11-19': 3000,
    },
    dailySessions: { '2026-11-19': 4 },
    dailyPrompts: { '2026-11-19': 12 },
  },
  achievements: [
    { id: 'a1', name: '计划狂', points: 20, unlockedAt: at(2026, 11, 19, 9) },
    { id: 'a2', name: '先规划后动手', points: 40, unlockedAt: at(2026, 11, 19, 18) },
    { id: 'a3', name: '昨天解锁的', points: 99, unlockedAt: at(2026, 11, 18, 23) },
  ],
};

const report = daily.build(data, yesterday);
assert(report.tokens === 3000, `tokens ${report.tokens}`);
assert(report.sessions === 4, `sessions ${report.sessions}`);
assert(report.prompts === 12, `prompts ${report.prompts}`);
assert(report.unlocks.length === 2, `unlocks ${report.unlocks.length}`);
assert(report.points === 60, `points ${report.points}`);
assert(report.unlocks[0].id === 'a1', 'unlocks must be chronological');
// Previous 7 days: 13..18 (7 days) = 1000+0+2000+500+800+700 + the day before
// the window, which is 0 because it has no data.
assert(report.avg > 0, 'average should be positive');
assert(report.best === true, '3000 must beat the previous week');
assert(report.streak === 5, `streak ${report.streak} (15th..19th are consecutive)`);
assert(report.week.length === 7, 'week window');
assert(report.week[6].key === yesterday && report.week[6].tokens === 3000, 'week ends on the day');
assert(report.active === true, 'active day');

// A quiet day is still a valid report, but not an "active" one.
const quiet = daily.build(data, '2026-11-14');
assert(quiet.tokens === 0 && quiet.sessions === 0 && quiet.unlocks.length === 0, 'quiet day numbers');
assert(quiet.active === false, 'quiet day must not be active');

// An older Host that does not publish the per-day maps must be flagged, so the
// page can show "—" instead of a fake 0 sessions / 0 prompts.
const legacy = daily.build({ stats: { dailyTokens: { '2026-11-19': 5 } }, achievements: [] }, yesterday);
assert(legacy.tokens === 5, 'legacy token map still works');
assert(legacy.sessionsKnown === false && legacy.promptsKnown === false, 'legacy host must be flagged');

// Consecutive days count backwards from the selected day.
const streakReport = daily.build(
  { stats: { dailyTokens: { '2026-11-17': 10, '2026-11-18': 10, '2026-11-19': 10 } }, achievements: [] },
  yesterday,
);
assert(streakReport.streak === 3, `streak ${streakReport.streak}`);

// --- "yesterday's digest, once per day" ----------------------------------
const now = at(2026, 11, 20, 10); // the morning after
assert(daily.pending(data, now, null) !== null, 'first open must produce a digest');
assert(daily.pending(data, now, yesterday) === null, 'seen digest must not repeat');
assert(daily.pending(data, now, '2026-11-18') !== null, 'an older seen key still produces the digest');
// A digest only summarizes a day that has already ended: on the 19th it must
// point at the 18th, never at the still-running day.
const sameDay = daily.pending(data, at(2026, 11, 19, 10), null);
assert(sameDay && sameDay.dateKey === '2026-11-18', 'digest always summarizes the finished day');
assert(
  daily.pending({ stats: { dailyTokens: {} }, achievements: [] }, at(2026, 11, 19, 10), null) === null,
  'an empty yesterday must not produce a digest',
);

// Midnight rollover: the same page, 0:05 the next day, must now summarize the
// day that just ended.
const midnight = at(2026, 11, 20, 0);
const midnightReport = daily.pending(data, midnight, '2026-11-18');
assert(midnightReport && midnightReport.dateKey === yesterday, 'midnight must settle the previous day');

// Seen state round-trips through localStorage.
daily.writeSeen(yesterday);
assert(daily.readSeen() === yesterday, 'seen key must persist');
assert(daily.pending(data, now, daily.readSeen()) === null, 'persisted seen key suppresses the digest');

// --- the tab renders ------------------------------------------------------
function walk(node, out = { texts: [], classes: [] }) {
  if (node == null || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return out;
  }
  if (typeof node === 'object') {
    if (typeof node.type === 'function') {
      walk(node.type(node.props || {}), out);
      return out;
    }
    if (node.props && typeof node.props.className === 'string') out.classes.push(node.props.className);
    walk(node.children, out);
    return out;
  }
  if (typeof node === 'string') out.texts.push(node);
  return out;
}

const views = mod.__views;
assert(typeof views.DailyTab === 'function', 'missing DailyTab');
assert(typeof views.DailyDigest === 'function', 'missing DailyDigest');
const tree = views.DailyTab({ data, t: (key) => key, locale: 'zh' });
const walked = walk(tree);
assert(walked.classes.some((name) => name.includes('cq-daily')), 'daily tab must render its root');
assert(walked.texts.includes('3000') || walked.texts.includes('3.0K'), 'daily tab must show the token total');
assert(walked.texts.filter((text) => text === '+20' || text === '+40').length === 2, 'unlock rows');

console.log('daily report: day keys + numbers + digest + render ok');