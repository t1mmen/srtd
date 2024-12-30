import { afterAll, beforeAll, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs/promises';
import { disconnect } from './src/utils/db.connection.js';

export const TEST_ROOT = join(tmpdir(), `srtd-test-${Date.now()}`);

beforeAll(async () => {
  await fs.mkdir(TEST_ROOT, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_ROOT, { recursive: true, force: true });
  await disconnect();
});

vi.mock('./src/utils/config', async () => ({
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
}));
