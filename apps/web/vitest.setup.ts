// Loaded by every vitest run (see root vitest.config.ts). DOM matchers only
// make sense under jsdom, so guard the import; the act flag is harmless in node.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}
