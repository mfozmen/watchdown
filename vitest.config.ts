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
      // Measure the source, not the tests or config.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
