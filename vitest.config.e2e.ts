/**
 * Vitest configuration for Database E2E tests.
 *
 * These tests require a real Postgres instance running (via Supabase).
 * Run with: npm run test:e2e:db
 *
 * Key differences from main config:
 * - No file parallelism (prevents DB connection contention)
 * - Longer timeout (30s for DB operations)
 * - Bail on first failure (fail fast)
 * - Only includes database.test.ts
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/vitest.setup.ts'],
    // Only run DB E2E tests
    include: ['src/__tests__/e2e/database.test.ts'],
    // Sequential execution for DB tests - prevents connection pool contention
    fileParallelism: false,
    // Longer timeout for database operations
    testTimeout: 30000,
    // Fail fast if DB is unavailable or tests fail
    bail: 1,
    // Ensure proper cleanup order (LIFO)
    sequence: {
      hooks: 'stack',
    },
  },
});
