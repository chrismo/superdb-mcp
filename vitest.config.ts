import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    // Only the TypeScript sources: the build also emits compiled copies of
    // the tests into dist/, which can be stale.
    include: ['src/**/*.test.ts'],
  },
});
