/**
 * Client smoke test: loads client.js through a stub module loader and calls
 * its `apply` against a stub Cordis client context. Catches the failure modes
 * that blank a slot entry — a module-level throw and a bad registration shape.
 */
let captured = null;

/** In-memory stand-ins so the HUD preference rules can be exercised. */
const store = new Map();
const memoryStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      captured = entry;
    },
  },
  location: { pathname: '/dsh/' },
  localStorage: memoryStorage,
  sessionStorage: memoryStorage,
  innerWidth: 1440,
  innerHeight: 900,
  setInterval: () => 0,
  clearInterval: () => {},
};

const noop = () => {};
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, noop],
  useEffect: noop,
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useRef: (initial) => ({ current: initial }),
  Fragment: 'fragment',
};

await import('../client.js');

if (!captured || captured.id !== 'dsh-codequest') throw new Error('module did not register with the expected id');
console.log('module id:', captured.id);

const clientModule = captured.factory((name) => {
  if (name === 'react') return fakeReact;
  throw new Error(`unexpected module request: ${name}`);
});
console.log('exports:', Object.keys(clientModule).join(', '), '| inject:', clientModule.inject.join(', '));

const registrations = [];
const effects = [];
const localeCalls = [];

clientModule.apply({
  effect(fn, label) {
    effects.push(label);
    const dispose = fn();
    if (typeof dispose === 'function') dispose();
    return () => {};
  },
  locale: {
    register(ns, dict) {
      localeCalls.push(`register:${ns}:${Object.keys(dict).join('/')}`);
      return () => {};
    },
    bind(ns) {
      localeCalls.push(`bind:${ns}`);
      return (key) => (key === 'tab' ? 'CodeQuest' : undefined);
    },
  },
  slots: {
    inject(slot, callback) {
      if (slot !== 'conversation.view' && slot !== 'shell.overlay') throw new Error(`unexpected slot ${slot}`);
      callback();
      return () => {};
    },
    register(options, component) {
      registrations.push({ options, component });
      return () => {};
    },
  },
});

if (registrations.length !== 2) throw new Error(`expected 2 registrations, got ${registrations.length}`);
for (const { options, component } of registrations) {
  console.log(
    'slot:', options.name, '| id:', options.id, '| order:', options.order,
    '| label:', typeof options.label === 'function' ? options.label() : '(none)',
    '| component:', typeof component === 'function',
  );
}
const view = registrations.find((entry) => entry.options.name === 'conversation.view');
const overlay = registrations.find((entry) => entry.options.name === 'shell.overlay');
if (!view || !overlay) throw new Error('missing slot registration');
if (typeof view.component !== 'function' || typeof overlay.component !== 'function') {
  throw new Error('registered components must be functions');
}
// 解锁短片挂在成就页里，`shell.overlay` 只能注册浮层本体；这里曾经被
// 误写成 UnlockFilm，导致 HUD 消失且短片在没有 item 时直接抛错。
if (overlay.component !== clientModule.__views.QuestOverlay) {
  throw new Error('shell.overlay must register QuestOverlay');
}
console.log('locale calls:', localeCalls.join(', '));
console.log('effects:', effects.join(', '));

// --- floating card: it must come back after a restart ---------------------
// A stale `hidden` left in browser storage used to hide the HUD forever, with
// no way back except finding the dashboard toggle. The Host preference wins.
const hud = clientModule.__hud;
const seed = (hudPref, stored) => {
  clientModule.__store.data = { prefs: { hud: hudPref } };
  store.clear();
  if (stored) store.set('dsh-codequest.hud', stored);
};
const cases = [
  // [host pref, stored value, expected mode, why]
  ['pill', 'hidden', 'pill', 'a stale close must not survive a restart'],
  ['pill', null, 'pill', 'default is on'],
  ['open', null, 'open', 'preference asks for the expanded card'],
  ['open', 'pill', 'pill', 'the browser form wins over the default'],
  ['off', null, 'hidden', 'the master switch stays off'],
  ['off', 'open', 'hidden', 'the master switch beats the browser form'],
];
for (const [pref, stored, expected, why] of cases) {
  seed(pref, stored);
  const actual = hud.readHudMode();
  if (actual !== expected) throw new Error(`hud mode for pref=${pref} stored=${stored}: expected ${expected}, got ${actual} (${why})`);
}
// Closing only hides the current view: no storage write, so a reload restores it.
seed('pill', null);
hud.writeHudMode('hidden');
if (store.get('dsh-codequest.hud') !== undefined) throw new Error('closing the card must not persist a hidden state');
if (hud.readHudMode() !== 'hidden') throw new Error('closing the card should hide it right away');
hud.writeHudMode('pill');
if (hud.readHudMode() !== 'pill') throw new Error('reopening the card should bring it back');
// A remembered position outside the current viewport falls back to the corner.
if (hud.clampHudPos({ x: 5000, y: 5000 }) !== null) throw new Error('an off-screen position must be dropped');
if (hud.clampHudPos({ x: 100, y: 120 }) === null) throw new Error('an on-screen position must be kept');
console.log('hud modes:', cases.length + 4, 'checks');

// --- unlock film: every category must draw without throwing ---------------
// The cutscene is 12 particle recipes sharing one canvas loop; a typo in any
// of them blanks the film mid-playback, which is invisible to a static render.
const film = clientModule.__film;
const categories = ['token', 'interaction', 'time', 'text', 'workplace', 'code', 'mastery', 'explore', 'easter', 'fail', 'meta', 'social'];
if (Object.keys(film.draw).length !== categories.length) {
  throw new Error(`expected ${categories.length} film recipes, got ${Object.keys(film.draw).length}`);
}
const calls = [];
const fakeCtx = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'canvas') return { width: 420, height: 300 };
      return (...args) => {
        calls.push([String(prop), args.length]);
      };
    },
    set() {
      return true;
    },
  },
);
for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
  if (!film.spec[rarity]) throw new Error(`missing film spec for ${rarity}`);
}
let drawn = 0;
for (const category of categories) {
  const particles = film.spawn(category, film.spec.epic.count, 420, 300);
  if (particles.length !== film.spec.epic.count) throw new Error(`${category}: spawned ${particles.length} particles`);
  for (const p of particles.slice(0, 12)) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`${category}: non-finite position`);
    film.draw[category](fakeCtx, p, '#a855f7');
    drawn += 1;
  }
}
if (calls.length === 0) throw new Error('the film never touched the canvas');
if (film.spec.legendary.count <= film.spec.common.count) throw new Error('legendary must burst harder than common');
console.log('unlock film:', categories.length, 'recipes,', drawn, 'draws,', calls.length, 'canvas ops');

// --- unlock film: blank closes, content does not --------------------------
// 点空白直接关闭（播放中也一样），点徽章/文字/按钮不能误关。
const views = clientModule.__views;
const filmItem = {
  id: 'film_probe',
  name: '探针成就',
  cond: '条件说明',
  icon: '🎯',
  rarity: 'epic',
  category: 'code',
  points: 40,
  unlockedAt: 1,
};
const mount = (props) => views.UnlockFilm({ item: filmItem, t: (key) => key, ...props });
const stageOf = (tree) => tree.children[0];
const findByClass = (node, name) => {
  if (!node || typeof node !== 'object') return null;
  if (node.props && node.props.className === name) return node;
  for (const child of node.children || []) {
    const hit = findByClass(child, name);
    if (hit) return hit;
  }
  return null;
};
const actionsOf = (tree) => findByClass(stageOf(tree), 'cq-filmactions');

let done = 0;
let closed = 0;
let detail = 0;
const playing = mount({
  onDone: () => { done += 1; },
  onClose: () => { closed += 1; },
  onOpenDetail: () => { detail += 1; },
});
// 点舞台内部（徽章/文字）不算点空白，不能关闭。
stageOf(playing).props.onClick({ stopPropagation() {} });
if (closed !== 0 || done !== 0) throw new Error('stage click must not close the film');
if (actionsOf(playing)) throw new Error('playback must not show the end actions yet');
// 播放中点空白 = 直接关闭，并补记已看。
playing.props.onClick();
if (closed !== 1 || done !== 1) throw new Error(`blank click must close and mark seen (done=${done}, closed=${closed})`);

// 播完（preview 直接给终态）后，关闭与看详情必须真的生效。
done = 0;
closed = 0;
detail = 0;
const ended = mount({
  preview: 'settle',
  onDone: () => { done += 1; },
  onClose: () => { closed += 1; },
  onOpenDetail: () => { detail += 1; },
});
const actions = actionsOf(ended);
if (!actions) throw new Error('finished film must show close/detail actions');
actions.children[0].props.onClick({ stopPropagation() {} });
if (closed !== 1) throw new Error(`close button must call onClose (got ${closed})`);
ended.props.onClick();
if (closed !== 2) throw new Error('backdrop after the film ended should close it');
actions.children[1].props.onClick({ stopPropagation() {} });
if (detail !== 1) throw new Error(`detail button must call onOpenDetail (got ${detail})`);
console.log('unlock film: blank/close/detail wired');

// --- unlock film: NEW badge baseline -------------------------------------
// 首次运行只留最近 3 枚带 NEW，否则一屏全是新；看完后要能立刻落盘。
const seen = film.seen;
store.clear();
seen.reset();
const wall = ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({ id, unlockedAt: 10 - index }));
const baseline = seen.ensure(wall);
for (const id of ['a', 'b', 'c']) {
  if (baseline.has(id)) throw new Error(`${id} is among the latest three, it must stay NEW`);
}
for (const id of ['d', 'e']) {
  if (!baseline.has(id)) throw new Error(`${id} must be marked as already watched`);
}
seen.mark('a');
if (!seen.ensure(wall).has('a')) throw new Error('marking a film seen must survive the cached read');
if (!seen.read().has('a')) throw new Error('the seen set must be persisted');
seen.write(new Set(['z']));
if (!seen.read().has('z') || seen.read().has('a')) throw new Error('write must replace the persisted set');
// 列表还没加载完时不能落空基线，否则真实数据到达后整面墙都是 NEW。
store.clear();
seen.reset();
seen.ensure([]);
if (store.get('dsh-codequest.film-seen') !== undefined) {
  throw new Error('an empty wall must not persist a baseline');
}
const late = seen.ensure(wall);
if (late.has('a') || !late.has('d')) throw new Error('the first real wall must still build the baseline');
// 缓存为空但磁盘上有记录时，mark 只能追加，不能覆盖。
store.clear();
seen.reset();
seen.write(new Set(['old']));
seen.mark('new');
const merged = seen.read();
if (!merged.has('old') || !merged.has('new')) throw new Error('mark must merge with the stored set');
console.log('unlock film: NEW baseline + persistence ok');

console.log('OK');
