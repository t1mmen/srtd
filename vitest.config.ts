import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/vitest.config.*',
      ],
    },
    maxConcurrency: 1,
    setupFiles: ['./src/__tests__/vitest.setup.ts'],
    testTimeout: 10000,
  },
});
