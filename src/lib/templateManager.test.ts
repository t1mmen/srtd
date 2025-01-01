import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { default as path, join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_FN_PREFIX } from '../__tests__/vitest.setup.js';
import { connect, disconnect } from '../utils/databaseConnection.js';
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
    testContext.testFunctionName = `${TEST_FN_PREFIX}${testContext.timestamp}`;

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

  const createTemplate = async (name: string, content: string, dir?: string) => {
    const fullPath = dir
      ? join(testContext.testDir, 'test-templates', dir, name)
      : join(testContext.testDir, 'test-templates', name);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  };

  const createTemplateWithFunc = async (name: string, funcSuffix = '', dir?: string) => {
    const funcName = `${testContext.testFunctionName}${funcSuffix}`;
    const content = `CREATE FUNCTION ${funcName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
    return createTemplate(name, content, dir);
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
      await new Promise(resolve => setTimeout(resolve, 51));
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

  it('should handle template additions in watch mode', async () => {
    const manager = await TemplateManager.create(testContext.testDir);
    const changes: string[] = [];

    manager.on('templateChanged', template => {
      changes.push(template.name);
    });

    const watcher = await manager.watch();

    // Add new template after watch started
    await createTemplateWithFunc(`test-new-${testContext.timestamp}.sql`);
    await new Promise(resolve => setTimeout(resolve, 150));

    watcher.close();
    expect(changes).toContain(`test-new-${testContext.timestamp}`);
  });

  it('should handle templates in deep subdirectories', async () => {
    // Create nested directory structure
    const depth = 5;
    const templatePaths: string[] = [];

    for (let i = 1; i <= depth; i++) {
      const dir = [...Array(i)].map((_, idx) => `level${idx + 1}`).join('/');
      const templatePath = await createTemplateWithFunc(
        `depth-test-${i}-${testContext.timestamp}.sql`,
        `_depth_${i}`,
        dir
      );
      templatePaths.push(templatePath);
    }

    const manager = await TemplateManager.create(testContext.testDir);
    const changes: string[] = [];

    manager.on('templateChanged', template => {
      changes.push(template.name);
    });

    const watcher = await manager.watch();
    await new Promise(resolve => setTimeout(resolve, depth * 100 * 1.1));
    watcher.close();

    expect(changes.length).toBe(depth);
    // Verify each template was detected
    for (let i = 1; i <= depth; i++) {
      expect(changes).toContain(`depth-test-${i}-${testContext.timestamp}`);
    }
  });

  it('should only watch SQL files', async () => {
    const manager = await TemplateManager.create(testContext.testDir);
    const changes: string[] = [];

    manager.on('templateChanged', template => {
      changes.push(template.name);
    });

    const watcher = await manager.watch();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create various file types
    await fs.writeFile(join(testContext.testDir, 'test-templates/test.txt'), 'not sql');
    await fs.writeFile(join(testContext.testDir, 'test-templates/test.md'), 'not sql');
    await createTemplateWithFunc(`test-sql-${testContext.timestamp}.sql`);

    await new Promise(resolve => setTimeout(resolve, 500));
    watcher.close();

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(`test-sql-${testContext.timestamp}`);
  });

  it('should handle multiple template changes simultaneously', async () => {
    const manager = await TemplateManager.create(testContext.testDir);
    const changes = new Set<string>();
    const count = 5;

    manager.on('templateChanged', template => {
      changes.add(template.name);
    });

    const watcher = await manager.watch();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create multiple templates simultaneously
    await Promise.all([
      createTemplateWithFunc(`rapid_test-1-${testContext.timestamp}.sql`, '_batch_changes_1'),
      createTemplateWithFunc(`rapid_test-2-${testContext.timestamp}.sql`, '_batch_changes_2'),
      createTemplateWithFunc(`rapid_test-3-${testContext.timestamp}.sql`, '_batch_changes_3'),
      createTemplateWithFunc(
        `rapid_test-4-${testContext.timestamp}.sql`,
        '_batch_changes_4',
        'deep'
      ),
      createTemplateWithFunc(
        `rapid_test-5-${testContext.timestamp}.sql`,
        '_batch_changes_5',
        'deep/nested'
      ),
    ]);

    // Give enough time for all changes to be detected
    await new Promise(resolve => setTimeout(resolve, count * 100 * 1.1));
    watcher.close();

    expect(changes.size).toBe(count); // Should detect all 5 templates
    for (let i = 1; i <= count; i++) {
      expect(changes.has(`rapid_test-${i}-${testContext.timestamp}`)).toBe(true);
    }

    // Verify all templates were processed
    const client = await connect();
    try {
      for (let i = 1; i <= count; i++) {
        const res = await client.query(`SELECT proname FROM pg_proc WHERE proname = $1`, [
          `${testContext.testFunctionName}_batch_changes_${i}`,
        ]);
        expect(res.rows).toHaveLength(1);
      }
    } finally {
      client.release();
    }
  }, 15000);

  it('should handle rapid bulk template creation realistically', async () => {
    const TEMPLATE_COUNT = 50;
    const manager = await TemplateManager.create(testContext.testDir);
    const processed = new Set<string>();
    const failed = new Set<string>();
    const inProgress = new Set<string>();
    const events: Array<{ event: string; template: string; time: number }> = [];

    let resolveProcessing: () => void;
    const processingComplete = new Promise<void>(resolve => {
      resolveProcessing = resolve;
    });

    manager.on('templateChanged', ({ name }) => {
      events.push({ event: 'changed', template: name, time: Date.now() });
      inProgress.add(name);
    });

    manager.on('templateApplied', ({ name }) => {
      events.push({ event: 'applied', template: name, time: Date.now() });
      processed.add(name);
      inProgress.delete(name);
      if (processed.size + failed.size === TEMPLATE_COUNT) {
        resolveProcessing();
      }
    });

    manager.on('templateError', ({ template: { name }, error }) => {
      events.push({ event: 'error', template: name, time: Date.now() });
      failed.add(name);
      inProgress.delete(name);
      console.error('Template error:', { name, error });
      if (processed.size + failed.size === TEMPLATE_COUNT) {
        resolveProcessing();
      }
    });

    const watcher = await manager.watch();

    // Create all templates
    await Promise.all(
      Array.from({ length: TEMPLATE_COUNT }, (_, i) =>
        createTemplateWithFunc(`bulk_created_template_${i + 1}.sql`, `_bulk_${i + 1}`)
      )
    );

    await processingComplete;
    watcher.close();

    expect(processed.size + failed.size).toBe(TEMPLATE_COUNT);
    expect(inProgress.size).toBe(0);
    expect(failed.size).toBe(0);
  });

  it('should cleanup resources when disposed', async () => {
    const manager = await TemplateManager.create(testContext.testDir);
    const changes: string[] = [];

    manager.on('templateChanged', template => {
      changes.push(template.name);
    });

    await manager.watch();

    // Create template before disposal
    await createTemplateWithFunc(`test-before-dispose-${testContext.timestamp}.sql`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dispose and verify cleanup
    manager[Symbol.dispose]();

    // Try creating template after disposal
    await createTemplateWithFunc(`test-after-dispose-${testContext.timestamp}.sql`);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(`test-before-dispose-${testContext.timestamp}`);
  });

  it('should auto-cleanup with using statement', async () => {
    const changes: string[] = [];

    await (async () => {
      using manager = await TemplateManager.create(testContext.testDir);

      manager.on('templateChanged', template => {
        changes.push(template.name);
      });

      await manager.watch();
      await createTemplateWithFunc(`test-during-scope-${testContext.timestamp}.sql`);
      await new Promise(resolve => setTimeout(resolve, 100));
    })();

    // After scope exit, create another template
    await createTemplateWithFunc(`test-after-scope-${testContext.timestamp}.sql`);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(`test-during-scope-${testContext.timestamp}`);
  });
});
