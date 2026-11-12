/**
 * Client smoke test: loads client.js through a stub module loader and calls
 * its `apply` against a stub Cordis client context. Catches the failure modes
 * that blank a slot entry — a module-level throw and a bad registration shape.
 */
let captured = null;

globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      captured = entry;
    },
  },
  location: { pathname: '/dsh/' },
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
console.log('OK');
