import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // apps/api tests import `bun:test` and use Bun runtime APIs (Bun.password);
    // they run via `bun test` instead (see apps/api/package.json).
    exclude: ['**/node_modules/**', 'apps/api/**'],
    include: ['apps/**/*.{test,spec}.ts', 'packages/**/*.{test,spec}.ts'],
    restoreMocks: true,
  },
});
