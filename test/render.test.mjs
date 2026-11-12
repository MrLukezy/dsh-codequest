/**
 * Render test: calls the real view components with a real `/state` payload
 * (fetched from the running plugin, or from a fixture file) and a stub React.
 * A crash here is exactly what would blank the CodeQuest tab in the browser.
 */
import fs from 'node:fs';

const stateUrl = process.argv[2] || 'http://127.0.0.1:64903/dsh-codequest/state';

let payload;
if (/^https?:/.test(stateUrl)) {
  const response = await fetch(stateUrl);
  payload = await response.json();
} else {
  payload = JSON.parse(fs.readFileSync(stateUrl, 'utf8'));
}
if (!payload || !payload.ok) throw new Error('state payload is not ok');
console.log('payload: sessions=%d achievements=%d', payload.stats.sessions, payload.achievements.length);

let captured = null;
globalThis.window = {
  __ModuleLoader__: { load: (entry) => (captured = entry) },
  location: { pathname: '/dsh/' },
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: () => 0,
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
  throw new Error(`unexpected module: ${name}`);
});

const t = (key) => key;
const views = mod.__views;

/** Walk the element tree and collect statistics about what would render. */
function walk(node, stats = { elements: 0, text: [] }) {
  if (node == null || typeof node === 'boolean') return stats;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, stats);
    return stats;
  }
  if (typeof node === 'object') {
    stats.elements += 1;
    // AchievementCard is rendered as a component element, so count by prop.
    if (node.props && node.props.item && node.props.item.id) stats.cards = (stats.cards || 0) + 1;
    // Function components are invoked so their real output (img, spans) is counted.
    if (typeof node.type === 'function') {
      const rendered = node.type(node.props || {});
      walk(rendered, stats);
      return stats;
    }
    if (node.type === 'section') stats.sections = (stats.sections || 0) + 1;
    if (node.props && node.props.className === 'cq-card') stats.cards = (stats.cards || 0) + 1;
    if (node.type === 'img' && node.props && typeof node.props.src === 'string') {
      stats.images = (stats.images || 0) + 1;
      if (!/\/icon\/[a-z0-9_]+\.webp$/.test(node.props.src)) throw new Error(`bad icon url: ${node.props.src}`);
    }
    walk(node.children, stats);
    return stats;
  }
  if (typeof node === 'string') stats.text.push(node);
  return stats;
}

for (const name of ['LevelHeader', 'AchievementsTab', 'DashboardTab']) {
  const component = views[name];
  if (typeof component !== 'function') throw new Error(`missing view ${name}`);
  const tree = component({ data: payload, t });
  const stats = walk(tree);
  console.log(`${name}: elements=${stats.elements} sections=${stats.sections || 0} cards=${stats.cards || 0} images=${stats.images || 0} textNodes=${stats.text.length}`);
  if (stats.elements < 10) throw new Error(`${name} rendered almost nothing`);
}

// Overlay entries read the shared store, so seed it the way a poll would.
mod.__store.data = payload;
const overlay = walk(views.QuestOverlay({ t }));
console.log('QuestOverlay: elements=%d images=%d hud=%s', overlay.elements, overlay.images || 0, overlay.elements > 8);
if (overlay.elements < 8) throw new Error('overlay rendered almost nothing');

const unlockedItem = payload.achievements.find((item) => item.unlockedAt && item.art);
const detail = walk(views.AchievementDetail({ item: unlockedItem, t, onClose: () => {} }));
console.log('AchievementDetail: elements=%d images=%d', detail.elements, detail.images || 0);
if (detail.elements < 8 || !detail.images) throw new Error('detail modal did not render its art');

const account = walk(views.AccountTab({ data: payload, t, reload: async () => {} }));
console.log('AccountTab: elements=%d', account.elements);
if (account.elements < 8) throw new Error('account tab rendered almost nothing');

// The grouped wall must show every category as its own section.
const wall = walk(views.AchievementsTab({ data: payload, t }));
const categories = new Set(payload.achievements.map((item) => item.category));
console.log('categories:', [...categories].join(', '), '| sections:', wall.sections);
if (wall.sections !== categories.size) {
  throw new Error(`expected ${categories.size} category sections, got ${wall.sections}`);
}
if (wall.cards !== payload.achievements.length) {
  throw new Error(`expected ${payload.achievements.length} cards, got ${wall.cards}`);
}
// Every non-secret card must show real badge art, not the emoji fallback.
const secrets = payload.achievements.filter((item) => item.hidden && !item.unlockedAt).length;
if (wall.images !== payload.achievements.length - secrets) {
  throw new Error(`expected ${payload.achievements.length - secrets} badge images, got ${wall.images}`);
}
console.log('OK');