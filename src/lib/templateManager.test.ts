import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connect, disconnect } from '../utils/db.connection.js';
import { ensureDirectories } from '../utils/ensureDirectories.js';
import { TemplateManager } from './templateManager.js';

describe('TemplateManager', () => {
  const testContext = {
    timestamp: Date.now(),
    testDir: '',
    testFunctionName: '',
  };

  beforeEach(async () => {
    testContext.testDir = join(tmpdir(), `srtd-test-${testContext.timestamp}`);
    testContext.testFunctionName = `test_func_${testContext.timestamp}`;

    await ensureDirectories(testContext.testDir);

    const client = await connect();
    try {
      await client.query('BEGIN');
      await client.query(`DROP FUNCTION IF EXISTS ${testContext.testFunctionName}()`);
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
      await client.query(`DROP FUNCTION IF EXISTS ${testContext.testFunctionName}()`);
      await client.query('COMMIT');
    } catch (_) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    await fs.rm(testContext.testDir, { recursive: true, force: true });
    disconnect();
  });

  const createTemplate = async (name: string, content: string) => {
    const path = join(testContext.testDir, 'test-templates', name);
    await fs.writeFile(path, content);
    return path;
  };

  const createTemplateWithFunc = async (name: string, funcSuffix = '') => {
    const funcName = `${testContext.testFunctionName}${funcSuffix}`;
    const content = `CREATE FUNCTION ${funcName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
    return createTemplate(name, content);
  };

  it('should create migration file when template changes', async () => {
    await createTemplateWithFunc(`test-${testContext.timestamp}.sql`);

    const manager = await TemplateManager.create(testContext.testDir);
    await manager.processTemplates({ generateFiles: true });

    const migrations = await fs.readdir(join(testContext.testDir, 'test-migrations'));
    const relevantMigrations = migrations.filter(m => m.includes(`test-${testContext.timestamp}`));
    expect(relevantMigrations).toHaveLength(1);
  });

  it('should not allow building WIP templates', async () => {
    await createTemplateWithFunc(`test-${testContext.timestamp}.wip.sql`);

    const manager = await TemplateManager.create(testContext.testDir);
    await manager.processTemplates({ generateFiles: true });

    const migrations = await fs.readdir(join(testContext.testDir, 'test-migrations'));
    expect(migrations.filter(m => m.includes(`test-${testContext.timestamp}`))).toHaveLength(0);
  });

  it('should maintain separate build and local logs', async () => {
    const templatePath = join(
      testContext.testDir,
      'test-templates',
      `test-${testContext.timestamp}.sql`
    );
    const templateContent = `CREATE FUNCTION ${testContext.testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
    await fs.writeFile(templatePath, templateContent);

    const manager = await TemplateManager.create(testContext.testDir);

    // Build writes to build log
    await manager.processTemplates({ generateFiles: true });
    const buildLog = JSON.parse(
      await fs.readFile(join(testContext.testDir, '.buildlog-test.json'), 'utf-8')
    );
    const relPath = relative(testContext.testDir, templatePath);
    expect(buildLog.templates[relPath].lastBuildHash).toBeDefined();

    // Apply writes to local log
    await manager.processTemplates({ apply: true });
    const localLog = JSON.parse(
      await fs.readFile(join(testContext.testDir, '.buildlog-test.local.json'), 'utf-8')
    );
    expect(localLog.templates[relPath].lastAppliedHash).toBeDefined();
  });

  it('should track template state correctly', async () => {
    const templatePath = join(
      testContext.testDir,
      'test-templates',
      `test-${testContext.timestamp}.sql`
    );
    const templateContent = `CREATE FUNCTION ${testContext.testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
    await fs.writeFile(templatePath, templateContent);

    const manager = await TemplateManager.create(testContext.testDir);

    // Initially no state
    let status = await manager.getTemplateStatus(templatePath);
    expect(status.buildState.lastBuildHash).toBeUndefined();
    expect(status.buildState.lastAppliedHash).toBeUndefined();

    // After build
    await manager.processTemplates({ generateFiles: true });
    status = await manager.getTemplateStatus(templatePath);
    expect(status.buildState.lastBuildHash).toBeDefined();
    expect(status.buildState.lastBuildDate).toBeDefined();

    // After apply
    await manager.processTemplates({ apply: true });
    status = await manager.getTemplateStatus(templatePath);
    expect(status.buildState.lastAppliedHash).toBeDefined();
    expect(status.buildState.lastAppliedDate).toBeDefined();
  });

  it('should handle rapid template changes', async () => {
    const templatePath = join(
      testContext.testDir,
      'test-templates',
      `test-${testContext.timestamp}.sql`
    );
    const baseContent = `CREATE FUNCTION ${testContext.testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;

    await fs.writeFile(templatePath, baseContent);

    const manager = await TemplateManager.create(testContext.testDir);
    const changes: string[] = [];

    manager.on('templateChanged', async template => {
      changes.push(template.currentHash);
    });

    const watcher = await manager.watch();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Make rapid changes
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(templatePath, `${baseContent}\n-- Change ${i}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    watcher.close();

    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(new Set(changes).size).toBe(changes.length); // All changes should be unique
  }, 10000);

  it('should apply WIP templates directly to database', async () => {
    const templatePath = join(
      testContext.testDir,
      'test-templates',
      `test-${testContext.timestamp}.wip.sql`
    );
    const templateContent = `CREATE FUNCTION ${testContext.testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
    await fs.writeFile(templatePath, templateContent);

    const manager = await TemplateManager.create(testContext.testDir);

    const result = await manager.processTemplates({ apply: true });
    expect(result.errors).toHaveLength(0);

    const client = await connect();
    try {
      const res = await client.query(`SELECT COUNT(*) FROM pg_proc WHERE proname = $1`, [
        testContext.testFunctionName,
      ]);
      expect(Number.parseInt(res.rows[0].count)).toBe(1);
    } finally {
      client.release();
    }
  });

  it('should handle sequential template operations', async () => {
    const templates = await Promise.all(
      [...Array(5)].map((_, i) =>
        createTemplateWithFunc(`test-${i}-${testContext.timestamp}.sql`, `_${i}`)
      )
    );

    const manager = await TemplateManager.create(testContext.testDir);

    // Apply templates one by one
    for (const _templatePath of templates) {
      const result = await manager.processTemplates({ apply: true });
      expect(result.errors).toHaveLength(0);
    }

    const client = await connect();
    try {
      for (let i = 0; i < 5; i++) {
        const res = await client.query(`SELECT proname FROM pg_proc WHERE proname = $1`, [
          `${testContext.testFunctionName}_${i}`,
        ]);
        expect(res.rows).toHaveLength(1);
      }
    } finally {
      client.release();
    }
  });

  it('should generate unique timestamps for multiple templates', async () => {
    const templates = await Promise.all(
      [...Array(10)].map((_, i) =>
        createTemplateWithFunc(`test-${i}-${testContext.timestamp}.sql`, `_${i}`)
      )
    );

    const manager = await TemplateManager.create(testContext.testDir);
    await manager.processTemplates({ generateFiles: true });

    const migrations = await fs.readdir(join(testContext.testDir, 'test-migrations'));
    const timestamps = migrations.map(m => m.split('_')[0]);
    const uniqueTimestamps = new Set(timestamps);

    expect(uniqueTimestamps.size).toBe(templates.length);
    expect(timestamps).toEqual([...timestamps].sort());
  });

  it('should handle mix of working and broken templates', async () => {
    await createTemplateWithFunc(`test-good-${testContext.timestamp}.sql`, '_good');
    await createTemplate(`test-bad-${testContext.timestamp}.sql`, 'INVALID SQL SYNTAX;');

    const manager = await TemplateManager.create(testContext.testDir);
    const result = await manager.processTemplates({ apply: true });

    expect(result.errors).toHaveLength(1);
    expect(result.applied).toHaveLength(1);

    const client = await connect();
    try {
      const res = await client.query(`SELECT COUNT(*) FROM pg_proc WHERE proname = $1`, [
        `${testContext.testFunctionName}_good`,
      ]);
      expect(Number.parseInt(res.rows[0].count)).toBe(1);
    } finally {
      client.release();
    }
  });

  it('should handle database errors gracefully', async () => {
    const manager = await TemplateManager.create(testContext.testDir);
    await createTemplate(`test-error-${testContext.timestamp}.sql`, 'SELECT 1/0;'); // Division by zero error

    const result = await manager.processTemplates({ apply: true });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.error).toMatch(/division by zero/i);
  });

  it('should handle file system errors', async () => {
    const errorPath = join(
      testContext.testDir,
      'test-templates',
      `test-error-${testContext.timestamp}.sql`
    );
    try {
      await createTemplate(`test-error-${testContext.timestamp}.sql`, 'SELECT 1;');
      await fs.chmod(errorPath, 0o000);

      const manager = await TemplateManager.create(testContext.testDir);
      await manager.processTemplates({ generateFiles: true });

      // Cleanup for afterEach
      await fs.chmod(errorPath, 0o644);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        errno: -13,
        code: 'EACCES',
        syscall: 'open',
        path: expect.stringContaining('test-error'),
      });
      // expect(error.length).toBeGreaterThan(0);
    }
  });

  it('should handle large batches of templates', async () => {
    // Create 50 templates
    await Promise.all(
      [...Array(50)].map((_, i) =>
        createTemplateWithFunc(`test-${i}-${testContext.timestamp}.sql`, `_${i}`)
      )
    );

    const manager = await TemplateManager.create(testContext.testDir);
    const result = await manager.processTemplates({ generateFiles: true });

    expect(result.errors).toHaveLength(0);
    const migrations = await fs.readdir(join(testContext.testDir, 'test-migrations'));
    expect(migrations.length).toBe(50);
  });

  it('should handle templates with complex SQL', async () => {
    const complexSQL = `
      CREATE OR REPLACE FUNCTION ${testContext.testFunctionName}(
        param1 integer DEFAULT 100,
        OUT result1 integer,
        OUT result2 text
      ) RETURNS record AS $$
      DECLARE
        temp_var integer;
      BEGIN
        -- Complex logic with multiple statements
        SELECT CASE
          WHEN param1 > 100 THEN param1 * 2
          ELSE param1 / 2
        END INTO temp_var;

        result1 := temp_var;
        result2 := 'Processed: ' || temp_var::text;

        -- Exception handling
        EXCEPTION WHEN OTHERS THEN
          result1 := -1;
          result2 := SQLERRM;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await createTemplate(`test-complex-${testContext.timestamp}.sql`, complexSQL);

    const manager = await TemplateManager.create(testContext.testDir);
    const result = await manager.processTemplates({ apply: true });
    expect(result.errors).toHaveLength(0);

    const client = await connect();
    try {
      const res = await client.query(
        `
        SELECT proname, pronargs, prorettype::regtype::text as return_type
        FROM pg_proc
        WHERE proname = $1
      `,
        [testContext.testFunctionName]
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].return_type).toBe('record');
    } finally {
      client.release();
    }
  });

  it('should maintain template state across manager instances', async () => {
    const template = await createTemplateWithFunc(`test-${testContext.timestamp}.sql`);

    // First manager instance
    const manager1 = await TemplateManager.create(testContext.testDir);
    await manager1.processTemplates({ generateFiles: true });

    // Second manager instance should see the state
    const manager2 = await TemplateManager.create(testContext.testDir);
    const status = await manager2.getTemplateStatus(template);
    expect(status.buildState.lastBuildHash).toBeDefined();
  });
});
