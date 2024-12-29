import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TemplateManager } from '../lib/templateManager';
import { disconnect } from '../utils/db.connection';
import fs from 'fs/promises';
import path from 'path';
import { connect } from '../utils/db.connection';

vi.mock('../utils/config', () => ({
  getConfig: vi.fn().mockResolvedValue({
    wipIndicator: '.wip',
    templateDir: 'test-templates',
    migrationDir: 'test-migrations',
    buildLog: '.buildlog-test.json',
    localBuildLog: '.buildlog-test.local.json',
    pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
  }),
}));

vi.mock('../utils/isWipTemplate', () => ({
  isWipTemplate: vi.fn().mockImplementation(path => path.includes('.wip')),
}));

describe('TemplateManager', () => {
  const timestamp = Date.now();
  const testDir = path.join(process.cwd(), `test-tmp-${timestamp}`);
  const templateDir = path.join(testDir, 'test-templates');
  const migrationDir = path.join(testDir, 'test-migrations');
  const buildLogPath = path.join(testDir, '.buildlog-test.json');
  const localBuildLogPath = path.join(testDir, '.buildlog-test.local.json');

  beforeEach(async () => {
    await fs.mkdir(templateDir, { recursive: true });
    await fs.mkdir(migrationDir, { recursive: true });

    const emptyLog = { version: '1.0', templates: {}, lastTimestamp: '' };
    await fs.writeFile(buildLogPath, JSON.stringify(emptyLog));
    await fs.writeFile(localBuildLogPath, JSON.stringify(emptyLog));

    // Clean up test tables
    const client = await connect();
    try {
      await client.query('BEGIN');
      await client.query(`DROP TABLE IF EXISTS test_${timestamp}`);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await disconnect();
    vi.clearAllMocks();
  });

  it('should detect template changes correctly', async () => {
    const template = `test-${timestamp}.sql`;
    const templatePath = path.join(templateDir, template);
    await fs.writeFile(templatePath, `CREATE TABLE test_${timestamp}();`);

    const manager = await TemplateManager.create(testDir);
    const result = await manager.processTemplates({ generateFiles: true });

    expect(result.errors).toHaveLength(0);

    const migrations = await fs.readdir(migrationDir);
    const relevantMigrations = migrations.filter(m => m.includes('test-'));
    expect(relevantMigrations).toHaveLength(1);
    expect(relevantMigrations[0]).toMatch(new RegExp(`^\\d{14}_tmpl-test-${timestamp}\\.sql$`));
  });

  it('should handle WIP templates correctly', async () => {
    const template = `test-${timestamp}.wip.sql`;
    const templatePath = path.join(templateDir, template);
    await fs.writeFile(templatePath, `CREATE TABLE test_${timestamp}();`);

    const manager = await TemplateManager.create(testDir);

    const buildResult = await manager.processTemplates({ generateFiles: true });
    const migrations = await fs.readdir(migrationDir);
    const relevantMigrations = migrations.filter(m => m.includes(`test-${timestamp}`));
    expect(relevantMigrations).toHaveLength(0);

    const applyResult = await manager.processTemplates({ apply: true });
    expect(applyResult.errors).toHaveLength(0);
  });
});
