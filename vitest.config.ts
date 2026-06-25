import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // `lcov` emits coverage/lcov.info for SonarQube Cloud; `text` prints a
      // summary in the CI log.
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      // Measure the pure core, not tests, type decls, or the Electron/DOM adapter
      // (main/preload/renderer are untestable glue, verified by typecheck + manual run).
      include: ['src/core/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
