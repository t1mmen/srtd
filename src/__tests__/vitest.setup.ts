import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, vi } from 'vitest';
import { disconnect } from '../utils/databaseConnection.js';

export const TEST_FN_PREFIX = 'srtd_scoped_test_func_';
export const TEST_ROOT_BASE = join(tmpdir(), 'srtd-test');
export const TEST_ROOT = join(TEST_ROOT_BASE, `srtd-tests-${Date.now()}`);

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

  // No need for global database cleanup as each test now cleans up after itself
  // using the TestResource dispose pattern
  void disconnect();
});

vi.mock('../utils/config', async importOriginal => {
  const actual = (await importOriginal()) as typeof import('../utils/config.js');
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      wipIndicator: '.wip',
      filter: '**/*.sql',
      templateDir: 'test-templates',
      migrationDir: 'test-migrations',
      buildLog: '.buildlog-test.json',
      localBuildLog: '.buildlog-test.local.json',
      pgConnection:
        process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
      banner: 'Test banner',
      footer: 'Test footer',
      wrapInTransaction: true,
    }),
  };
});
