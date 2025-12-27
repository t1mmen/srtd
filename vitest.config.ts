import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: true, // Enable running files in parallel
    maxConcurrency: 5, // Allow up to 5 files to run concurrently
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
    setupFiles: ['./src/__tests__/vitest.setup.ts'],
    testTimeout: 10000,
    // Exclude DB E2E tests from default run - they require real Postgres
    exclude: ['**/node_modules/**', 'src/__tests__/e2e/database.test.ts'],
  },
});
