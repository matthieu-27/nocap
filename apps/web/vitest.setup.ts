// Loaded by every vitest run (see root vitest.config.ts). DOM matchers only
// make sense under jsdom, so guard the import; the act flag is harmless in node.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');

  // Vitest runs without `globals: true`, so @testing-library/react cannot
  // register its auto-cleanup itself; unmount between tests explicitly.
  const { cleanup } = await import('@testing-library/react');
  const { afterEach } = await import('vitest');
  afterEach(cleanup);

  // Node >=22.4 ships an experimental `localStorage` global that shadows
  // jsdom's inside vitest workers (it reads as undefined without
  // --localstorage-file); re-expose the jsdom storage so DOM tests see
  // browser behavior. The raw jsdom window hangs off `global.jsdom`
  // because vitest binds `window` to the patched global itself.
  if (globalThis.localStorage === undefined) {
    const dom = (
      globalThis as { jsdom?: { window: { localStorage: Storage } } }
    ).jsdom;
    const storage = dom?.window.localStorage;
    if (storage) {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          return storage;
        },
      });
    }
  }
}

export {};
