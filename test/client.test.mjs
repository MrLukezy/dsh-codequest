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

console.log('OK');
