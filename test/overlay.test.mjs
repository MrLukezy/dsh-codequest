/**
 * Overlay copy + click-through test.
 *
 * The floating layer (HUD / unlock toast) gets no props, so it can only use the
 * module-level translator. A half-registered locale service used to echo the
 * raw key back (`bound('unlockedToast') === 'unlockedToast'`), which put
 * `UNLOCKEDTOAST` on screen. This test pins both the fallback and the
 * "open the standalone page" wiring used by the HUD's ▣ button.
 *
 * Run: node test/overlay.test.mjs
 */
let captured = null;

globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      captured = entry;
    },
  },
  location: { pathname: '/dsh/' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
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
const clientModule = captured.factory((name) => {
  if (name === 'react') return fakeReact;
  throw new Error(`unexpected module request: ${name}`);
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ZH = '成就解锁';
const EN = 'Achievement unlocked';

// The bundled dictionary resolves the key on its own, whichever language the
// runtime reports (Node reports en-US; the DSH page usually sets zh-CN).
const builtin = clientModule.__i18n.builtin('unlockedToast');
assert([ZH, EN].includes(builtin), `builtin translator returned ${JSON.stringify(builtin)}`);
assert(clientModule.__i18n.builtin('no_such_key') === 'no_such_key', 'unknown keys must pass through');

const selectedPanels = [];
clientModule.apply({
  effect(fn) {
    const dispose = fn();
    if (typeof dispose === 'function') dispose();
    return () => {};
  },
  layout: {
    selectPanel(id) {
      selectedPanels.push(id);
    },
  },
  locale: {
    register() {
      return () => {};
    },
    // Simulates a namespace that has not been registered yet: the service
    // echoes the key instead of returning a translation.
    bind() {
      return (key) => key;
    },
  },
  slots: {
    inject(_slot, callback) {
      callback();
      return () => {};
    },
    register() {
      return () => {};
    },
  },
});

const translated = clientModule.__i18n.t('unlockedToast');
assert([ZH, EN].includes(translated), `overlay translator echoed the raw key: ${translated}`);
assert(clientModule.__i18n.t('no_such_key') === 'no_such_key', 'unknown keys must still pass through');

// The HUD's ▣ button opens the standalone page; the seam mirrors its onClick.
assert(clientModule.__i18n.openPage() === true, 'openPage should be wired after apply');
assert(selectedPanels[0] === 'codequest', `openPage should select the codequest panel, got ${selectedPanels[0]}`);

// The unlock toast is an entry as well: clicking it opens the page instead of
// only closing itself. The 6s timer keeps using onDone.
const clicked = [];
const toastNode = clientModule.__views.QuestToast({
  entry: { kind: 'achievement', item: { id: 'a1', name: '计划狂', points: 20, desc: 'desc' } },
  t: (key) => key,
  onDone: () => clicked.push('done'),
  onOpen: () => clicked.push('open'),
});
toastNode.props.onClick();
assert(
  clicked.length === 1 && clicked[0] === 'open',
  `toast click should open the page, got ${clicked.join(',') || 'nothing'}`,
);

// Panel not registered yet: the click must still close the bubble.
const fallback = [];
const bareToast = clientModule.__views.QuestToast({
  entry: { kind: 'lore', item: { id: 'l1', title: '第一章' } },
  t: (key) => key,
  onDone: () => fallback.push('done'),
});
bareToast.props.onClick();
assert(fallback[0] === 'done', 'toast click without open-page wiring should dismiss');

console.log('overlay i18n + open-page: ok');