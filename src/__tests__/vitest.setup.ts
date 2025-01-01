import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, vi } from 'vitest';
import { connect, disconnect } from '../utils/databaseConnection.js';

export const TEST_FN_PREFIX = 'srtd_scoped_test_func_';
export const TEST_ROOT = join(tmpdir(), `srtd-test-${Date.now()}`);

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
  await fs.mkdir(TEST_ROOT, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_ROOT, { recursive: true, force: true });

  // Be extra sure to clean up any test functions from db
  const client = await connect();
  try {
    await client.query('BEGIN');
    await client.query(`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN
        SELECT quote_ident(proname) AS func_name
        FROM pg_proc
        WHERE proname LIKE '${TEST_FN_PREFIX}%'
      LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name;
      END LOOP;
    END;
    $$;
    `);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  disconnect();
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
