import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, vi } from 'vitest';
import { DEFAULT_PG_CONNECTION } from '../constants.js';

// Set test mode early to suppress CLI output in Commander
process.env.SRTD_TEST_MODE = 'true';

export const TEST_FN_PREFIX = 'srtd_scoped_test_func_';
export const TEST_ROOT_BASE = join(tmpdir(), 'srtd-test');
export const TEST_ROOT = join(TEST_ROOT_BASE, `srtd-tests-${Date.now()}`);

// Shared test database service instance (lazy loaded to avoid polluting module cache)
let testDatabaseService:
  | InstanceType<typeof import('../services/DatabaseService.js').DatabaseService>
  | undefined;

/**
 * Get or create the shared test DatabaseService instance
 * Uses dynamic import to avoid polluting module cache before test mocks are applied
 */
export async function getTestDatabaseService(): Promise<
  InstanceType<typeof import('../services/DatabaseService.js').DatabaseService>
> {
  if (!testDatabaseService) {
    const { DatabaseService } = await import('../services/DatabaseService.js');
    const connectionString = process.env.POSTGRES_URL || DEFAULT_PG_CONNECTION;
    testDatabaseService = new DatabaseService({ connectionString });
  }
  return testDatabaseService;
}

vi.mock('../utils/logger', () => ({
  logger: {
    info: () => {
      /** noop */
    },
    success: () => {
      /** noop */
    },
    warn: () => {
      /** noop */
    },
    error: () => {
      /** noop */
    },
    skip: () => {
      /** noop */
    },
    debug: () => {
      /** noop */
    },
  },
}));

beforeAll(async () => {
  try {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
    await fs.mkdir(TEST_ROOT_BASE, { recursive: true });
    await fs.mkdir(TEST_ROOT, { recursive: true });
  } catch (error) {
    console.error('Error creating test root:', error, ', retrying once.');
  }
});

afterAll(async () => {
  // Just clean up the test root directory
  await fs.rm(TEST_ROOT, { recursive: true, force: true });

  // Dispose the shared test database service
  if (testDatabaseService) {
    await testDatabaseService.dispose();
    testDatabaseService = undefined;
  }
});

vi.mock('../utils/config', async importOriginal => {
  const actual = (await importOriginal()) as typeof import('../utils/config.js');
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      config: {
        wipIndicator: '.wip',
        filter: '**/*.sql',
        templateDir: 'test-templates',
        migrationDir: 'test-migrations',
        buildLog: '.buildlog-test.json',
        localBuildLog: '.buildlog-test.local.json',
        pgConnection: process.env.POSTGRES_URL || DEFAULT_PG_CONNECTION,
        banner: 'Test banner',
        footer: 'Test footer',
        wrapInTransaction: true,
      },
      warnings: [],
    }),
  };
});
