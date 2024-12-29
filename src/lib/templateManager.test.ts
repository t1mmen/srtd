import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TemplateManager } from '../lib/templateManager.js';
import { disconnect } from '../utils/db.connection.js';
import fs from 'fs/promises';
import path from 'path';
import { connect } from '../utils/db.connection.js';

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
  const testFunctionName = `test_func_${timestamp}`;

  beforeEach(async () => {
    await fs.mkdir(templateDir, { recursive: true });
    await fs.mkdir(migrationDir, { recursive: true });

    const emptyLog = { version: '1.0', templates: {}, lastTimestamp: '' };
    await fs.writeFile(buildLogPath, JSON.stringify(emptyLog));
    await fs.writeFile(localBuildLogPath, JSON.stringify(emptyLog));

    const client = await connect();
    try {
      await client.query('BEGIN');
      await client.query(`DROP FUNCTION IF EXISTS ${testFunctionName}()`);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  afterEach(async () => {
    const client = await connect();
    try {
      await client.query('BEGIN');
      await client.query(`DROP FUNCTION IF EXISTS ${testFunctionName}()`);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    await fs.rm(testDir, { recursive: true, force: true });
    await disconnect();
    vi.clearAllMocks();
  });

  it('should create migration file when template changes', async () => {
    const template = `test-${timestamp}.sql`;
    const templatePath = path.join(templateDir, template);
    await fs.writeFile(
      templatePath,
      `CREATE FUNCTION ${testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`
    );

    const manager = await TemplateManager.create(testDir);
    const result = await manager.processTemplates({ generateFiles: true });

    expect(result.errors).toHaveLength(0);
    const migrations = await fs.readdir(migrationDir);
    const relevantMigrations = migrations.filter(m => m.includes('test-'));
    expect(relevantMigrations).toHaveLength(1);
    expect(relevantMigrations[0]).toMatch(new RegExp(`^\\d{14}_tmpl-test-${timestamp}\\.sql$`));
  });

  it('should not generate migration files for WIP templates', async () => {
    const template = `test-${timestamp}.wip.sql`;
    const templatePath = path.join(templateDir, template);
    await fs.writeFile(
      templatePath,
      `CREATE FUNCTION ${testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`
    );

    const manager = await TemplateManager.create(testDir);

    await manager.processTemplates({ generateFiles: true });
    const migrations = await fs.readdir(migrationDir);
    const relevantMigrations = migrations.filter(m => m.includes(`test-${timestamp}`));
    expect(relevantMigrations).toHaveLength(0);
  });

  it('should allow direct database apply for WIP templates', async () => {
    const template = `test-${timestamp}.wip.sql`;
    const templatePath = path.join(templateDir, template);
    await fs.writeFile(
      templatePath,
      `CREATE FUNCTION ${testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`
    );

    const manager = await TemplateManager.create(testDir);
    const result = await manager.processTemplates({ apply: true });
    expect(result.errors).toHaveLength(0);
  });
});
