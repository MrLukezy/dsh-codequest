/**
 * HUD card test: double-clicking the title collapses the card back into the
 * pill, and the collapse button is an up arrow (it used to be a minus sign).
 *
 * Run: node test/hud.test.mjs
 */
let captured = null;

const store = new Map([['dsh-codequest.hud', 'open']]);
globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      captured = entry;
    },
  },
  location: { pathname: '/dsh/' },
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
  innerWidth: 1440,
  innerHeight: 900,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
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

// The overlay only gets the layout service through `apply()`; wire a stub so
// the new "open the page" button can be exercised.
const selectedPanels = [];
mod.apply({
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

function find(node, predicate, hit = { value: null }) {
  if (hit.value || node == null || typeof node !== 'object') return hit.value;
  if (Array.isArray(node)) {
    for (const child of node) find(child, predicate, hit);
    return hit.value;
  }
  // Function components are invoked so their real output (svg, circle, …) is found.
  if (typeof node.type === 'function') {
    find(node.type(node.props || {}), predicate, hit);
    return hit.value;
  }
  if (predicate(node)) {
    hit.value = node;
    return hit.value;
  }
  for (const child of node.children || []) find(child, predicate, hit);
  return hit.value;
}

mod.__store.data = {
  prefs: { hud: 'open' },
  progress: { level: 16, title: '资深提示工程师', points: 2550, unlocked: 97, total: 314, levelInto: 60, levelNeed: 150 },
  stats: { tokensToday: 57380000, maxStreak: 5, dailyTokens: { '2026-11-16': 1000, '2026-11-17': 2000 } },
};

const tree = mod.__views.QuestHud({ t: (key) => key });

// Card effects: all three default on, and each can be removed independently.
const fxCard = find(tree, (node) => String(node.props.className || '').includes('cq-hudcard'));
assert(fxCard, 'the expanded card must render');
const fxClass = String(fxCard.props.className);
for (const name of ['cq-fx-laser', 'cq-fx-flow', 'cq-fx-color']) {
  assert(fxClass.includes(name), `the card should carry ${name} by default, got ${fxClass}`);
}
mod.__store.data.prefs.hudFx = { laser: false, flow: true, color: false };
const mixedFxCard = find(mod.__views.QuestHud({ t: (key) => key }), (node) => String(node.props.className || '').includes('cq-hudcard'));
const mixedClass = String(mixedFxCard.props.className);
assert(mixedClass.includes('cq-fx-flow'), 'the flow effect must stay on when selected');
assert(!mixedClass.includes('cq-fx-laser') && !mixedClass.includes('cq-fx-color'), 'turned-off effects must not render');
mod.__store.data.prefs.hudFx = { laser: false, flow: false, color: false };
const plainFxCard = find(mod.__views.QuestHud({ t: (key) => key }), (node) => String(node.props.className || '').includes('cq-hudcard'));
assert(!String(plainFxCard.props.className).includes('cq-fx-'), 'all effects off must leave a clean card');
delete mod.__store.data.prefs.hudFx;
assert(String(fxCard.props.className).includes('cq-fx-laser'), 'the earlier card snapshot must keep its classes');

const header = find(tree, (node) => String(node.props.className || '').includes('cq-hudhead'));
assert(header, 'the expanded card must render a title bar');
assert(typeof header.props.onDoubleClick === 'function', 'the title bar must handle double-click');
header.props.onDoubleClick();
assert(store.get('dsh-codequest.hud') === 'pill', `double-click should collapse to the pill, got ${store.get('dsh-codequest.hud')}`);
assert(mod.__hud.readHudMode() === 'pill', 'the card should read back as a pill after collapsing');

// Re-render in pill mode and check the collapse/expand affordances.
const pill = mod.__views.QuestHud({ t: (key) => key });
assert(pill && String(pill.props.className || '').includes('cq-hud'), 'the pill must still render');
const pillDown = find(pill, (node) => node.props && node.props.title === 'hudOpen');
assert(pillDown, 'the pill must show a down arrow that expands it');
assert(pillDown.children[0] === '↓', `pill expand glyph should be a down arrow, got ${JSON.stringify(pillDown.children[0])}`);

// The card's collapse button is an up arrow; find it by its hudClose tooltip.
store.set('dsh-codequest.hud', 'open');
const card = mod.__views.QuestHud({ t: (key) => key });
const collapse = find(card, (node) => node.props && node.props.title === 'hudClose');
assert(collapse, 'the card must keep a collapse button');
assert(collapse.children[0] === '↑', `collapse glyph should be an up arrow, got ${JSON.stringify(collapse.children[0])}`);

// Next to it: a square button that opens the standalone CodeQuest page.
const openBtn = find(card, (node) => node.props && node.props.title === 'openPage');
assert(openBtn, 'the card must offer a button that opens the page');
assert(openBtn.children[0] === '▣', `open-page glyph should be a square, got ${JSON.stringify(openBtn.children[0])}`);
openBtn.props.onClick({ stopPropagation() {} });
assert(selectedPanels[0] === 'codequest', `the square button should open the codequest panel, got ${selectedPanels[0]}`);

// Collapsed state must still show that work is happening: a live token gain
// lights the activity dot and pulses the sparkline end point.
mod.__store.float = { id: 7, amount: 1200, at: Date.now() };
store.set('dsh-codequest.hud', 'pill');
const livePill = mod.__views.QuestHud({ t: (key) => key });
const liveDot = find(livePill, (node) => String(node.props.className || '').includes('cq-hudlive'));
assert(liveDot, 'the pill must render an activity dot');
assert(String(liveDot.props.className).includes('on'), 'a fresh token gain must light the activity dot');
assert(liveDot.props.title === 'hudWorking', `the working dot should be labelled, got ${liveDot.props.title}`);
const liveSpark = find(livePill, (node) => String(node.props.className || '').includes('cq-sparkdot'));
assert(liveSpark && String(liveSpark.props.className).includes('on'), 'the sparkline end dot must pulse while working');
const liveNum = find(livePill, (node) => String(node.props.className || '').includes('cq-hudnum'));
assert(liveNum && String(liveNum.props.className).includes('tick'), 'the token counter should tick on a gain');

// Twelve seconds later the gain is stale: the dot goes back to idle.
mod.__store.float = { id: 7, amount: 1200, at: Date.now() - 13000 };
const idlePill = mod.__views.QuestHud({ t: (key) => key });
const idleDot = find(idlePill, (node) => String(node.props.className || '').includes('cq-hudlive'));
assert(idleDot, 'the idle pill must keep its dot');
assert(!String(idleDot.props.className).includes('on'), 'a stale gain must return the dot to idle');
assert(idleDot.props.title === 'hudIdle', `the idle dot should be labelled, got ${idleDot.props.title}`);

// Bar mode: a full-width docked strip at the bottom of the window.
store.set('dsh-codequest.hud', 'bar');
assert(mod.__hud.readHudMode() === 'bar', 'the bar form must be remembered per browser');
const barTree = mod.__views.QuestHud({ t: (key) => key });
assert(barTree && String(barTree.props.className || '').includes('cq-bar'), 'bar mode must render the docked strip');
const barDot = find(barTree, (node) => String(node.props.className || '').includes('cq-hudlive'));
assert(barDot, 'the bar must show the activity dot');
const barSpark = find(barTree, (node) => String(node.props.className || '').includes('cq-spark'));
assert(barSpark, 'the bar must show the mini curve');
const barOpen = find(barTree, (node) => node.props && node.props.title === 'openPage');
assert(barOpen && barOpen.children[0] === '▣', 'the bar must offer the open-page button');
// Clicking the strip itself (not one of its buttons) expands the card.
barTree.props.onClick({ target: { closest: () => null } });
assert(mod.__hud.readHudMode() === 'open', 'clicking the bar body should expand the card');
// Clicking a button inside the strip must not expand it as a side effect.
store.set('dsh-codequest.hud', 'bar');
const barTree2 = mod.__views.QuestHud({ t: (key) => key });
barTree2.props.onClick({ target: { closest: () => ({ tagName: 'BUTTON' }) } });
assert(mod.__hud.readHudMode() === 'bar', 'the strip buttons must not trigger the expand click');

// Expanding from the bar and pressing ↑ must return to the bar, not the pill.
const barTree3 = mod.__views.QuestHud({ t: (key) => key });
barTree3.props.onClick({ target: { closest: () => null } });
assert(mod.__hud.readHudMode() === 'open', 'the bar should expand into the card');
const cardFromBar = mod.__views.QuestHud({ t: (key) => key });
const upFromBar = find(cardFromBar, (node) => node.props && node.props.title === 'hudClose');
assert(upFromBar, 'the card must keep its collapse button');
upFromBar.props.onClick({ stopPropagation() {} });
assert(mod.__hud.readHudMode() === 'bar', `the card opened from the bar must collapse back to the bar, got ${mod.__hud.readHudMode()}`);

// Double-clicking the pill expands it; the dblclick the browser then fires on
// the freshly mounted title bar must not collapse it again in the same gesture.
store.set('dsh-codequest.hud', 'pill');
const pillTree = mod.__views.QuestHud({ t: (key) => key });
const pillMain = find(pillTree, (node) => String(node.props.className || '').includes('cq-hudpillmain'));
assert(pillMain, 'the pill must expose its expand button');
pillMain.props.onClick({ preventDefault() {}, stopPropagation() {} });
assert(mod.__hud.readHudMode() === 'open', 'clicking the pill should expand the card');
const expanded = mod.__views.QuestHud({ t: (key) => key });
const expandedHeader = find(expanded, (node) => String(node.props.className || '').includes('cq-hudhead'));
expandedHeader.props.onDoubleClick();
assert(mod.__hud.readHudMode() === 'open', 'the tail of an expand double-click must not collapse the card');
await new Promise((resolve) => setTimeout(resolve, 520));
expandedHeader.props.onDoubleClick();
assert(mod.__hud.readHudMode() === 'pill', 'a later double-click on the title should collapse again');

console.log('hud: bar/pill/card + ▣ + live dot ok');