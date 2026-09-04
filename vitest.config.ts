import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // apps/api tests import `bun:test` (Bun runtime) and run via `bun test`.
    exclude: ['**/node_modules/**', 'apps/api/**', 'apps/web/build/**'],
    include: ['apps/**/*.{test,spec}.{ts,tsx}', 'packages/**/*.{test,spec}.ts'],
    restoreMocks: true,
    environment: 'node',
    environmentMatchGlobs: [['apps/web/**/*.test.tsx', 'jsdom']],
    setupFiles: ['apps/web/vitest.setup.ts'],
  },
});
