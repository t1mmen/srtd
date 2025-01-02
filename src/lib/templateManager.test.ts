import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { default as path, join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_FN_PREFIX } from '../__tests__/vitest.setup.js';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { connect, disconnect } from '../utils/databaseConnection.js';
import { ensureDirectories } from '../utils/ensureDirectories.js';
import { TemplateManager } from './templateManager.js';

describe('TemplateManager', () => {
  const testContext = {
    testId: 0,
    testDir: '',
    testFunctionName: '',
    templateCounter: 0,
  };

  beforeEach(async () => {
    testContext.testId = Math.floor(Math.random() * 1000000);
    testContext.testDir = join(tmpdir(), `srtd-test`);
    testContext.testFunctionName = `${TEST_FN_PREFIX}`;
    testContext.templateCounter = 0;

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

  // Helper to generate unique template names
  const getNextTemplateName = (prefix = 'template') => {
    testContext.templateCounter++;
    return `${prefix}_${testContext.testId}_${testContext.templateCounter}`;
  };

  const createTemplate = async (name: string, content: string, dir?: string) => {
    const fullPath = dir
      ? join(testContext.testDir, 'test-templates', dir, name)
      : join(testContext.testDir, 'test-templates', name);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
      return fullPath;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  };

  const createTemplateWithFunc = async (prefix: string, funcSuffix = '', dir?: string) => {
    const name = `${getNextTemplateName(prefix)}.sql`;
    const funcName = `${testContext.testFunctionName}${funcSuffix}`;
    const content = `CREATE OR REPLACE FUNCTION ${funcName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
    return createTemplate(name, content, dir);
  };

  it('should create migration file when template changes', async () => {
    await createTemplateWithFunc('basic', '_file_change');

    const manager = await TemplateManager.create(testContext.testDir);
    await manager.processTemplates({ generateFiles: true });

    const migrations = await fs.readdir(join(testContext.testDir, 'test-migrations'));
    expect(migrations.length).toBe(1);
  });

  it('should not allow building WIP templates', async () => {
    await createTemplateWithFunc('file.wip', '_wip_wont_build');

    const manager = await TemplateManager.create(testContext.testDir);
    await manager.processTemplates({ generateFiles: true });

    const migrations = await fs.readdir(join(testContext.testDir, 'test-migrations'));
    expect(migrations.filter(m => m.includes(`wip`))).toHaveLength(0);
  });

  it('should maintain separate build and local logs', async () => {
    const templatePath = join(
      testContext.testDir,
      'test-templates',
      `template_${testContext.testId}_1.sql`
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
      `template_${testContext.testId}_1.sql`
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
      `template_${testContext.testId}_1.sql`
    );
    const baseContent = `CREATE OR REPLACE FUNCTION ${testContext.testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;

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
      `template_${testContext.testId}_1.wip.sql`
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
    await Promise.all(
      [...Array(5)].map((_, i) =>
        createTemplateWithFunc(`sequencetest_${i}`, `_sequence_test_${i}`)
      )
    );

    const manager = await TemplateManager.create(testContext.testDir);
    const client = await connect();

    try {
      // Start transaction for isolation
      await client.query('BEGIN');

      const result = await manager.processTemplates({ apply: true });
      expect(result.errors).toHaveLength(0);

      // Verify final state
      const allFunctions = await client.query(`SELECT proname FROM pg_proc WHERE proname LIKE $1`, [
        `${testContext.testFunctionName}_sequence_test_%`,
      ]);
      expect(allFunctions.rows).toHaveLength(5);
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Cleanup
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('should generate unique timestamps for multiple templates', async () => {
    const templates = await Promise.all(
      [...Array(10)].map((_, i) =>
        createTemplateWithFunc(`timestamptest_${i}`, `_unique_timestamps_${i}`)
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
    await createTemplateWithFunc(`a-test-good`, '_good_and_broken_mix');
    await createTemplate(`a-test-bad.sql`, 'INVALID SQL SYNTAX;');

    const manager = await TemplateManager.create(testContext.testDir);
    const result = await manager.processTemplates({ apply: true });

    expect(result.errors).toHaveLength(1);
    expect(result.applied).toHaveLength(1);

    const client = await connect();
    try {
      const res = await client.query(`SELECT COUNT(*) FROM pg_proc WHERE proname = $1`, [
        `${testContext.testFunctionName}_good_and_broken_mix`,
      ]);
      expect(Number.parseInt(res.rows[0].count)).toBe(1);
    } finally {
      client.release();
    }
  });

  it('should handle database errors gracefully', async () => {
    const manager = await TemplateManager.create(testContext.testDir);
    await createTemplate(`test-error.sql`, 'SELECT 1/0;'); // Division by zero error

    const result = await manager.processTemplates({ apply: true });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.error).toMatch(/division by zero/i);
  });

  it('should handle file system errors', async () => {
    const errorPath = join(testContext.testDir, 'test-templates', `test-error.sql`);
    try {
      await createTemplate(`test-error.sql`, 'SELECT 1;');
      await fs.chmod(errorPath, 0o000);

      const manager = await TemplateManager.create(testContext.testDir);
      try {
        await manager.processTemplates({ generateFiles: true });
      } catch (error) {
        expect(error).toBeDefined();
      }
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
      [...Array(50)].map((_, i) => createTemplateWithFunc(`test_${i}`, `_large_batch_${i}`))
    );

    const manager = await TemplateManager.create(testContext.testDir);
    const result = await manager.processTemplates({ generateFiles: true });

    expect(result.errors).toHaveLength(0);
    const migrations = await fs.readdir(join(testContext.testDir, 'test-migrations'));
    expect(migrations.length).toBe(50);
  });

  it('should handle templates with complex SQL', async () => {
    const testFunctionName = `${testContext.testFunctionName}_complex`;
    const complexSQL = `
      CREATE OR REPLACE FUNCTION ${testFunctionName}(
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
    await createTemplate(`test-complex.sql`, complexSQL);

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
        [testFunctionName]
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].return_type).toBe('record');
    } finally {
      client.release();
    }
  });

  it('should maintain template state across manager instances', async () => {
    const template = await createTemplateWithFunc(`test`, 'maintain_state');

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
    await createTemplateWithFunc('new', '_watch_addition');
    await new Promise(resolve => setTimeout(resolve, 150));

    watcher.close();
    expect(changes).toContain(`new_${testContext.testId}_1`);
  });

  it('should handle templates in deep subdirectories', async () => {
    // Create nested directory structure
    const depth = 5;
    const templatePaths: string[] = [];

    for (let i = 1; i <= depth; i++) {
      const dir = [...Array(i)].map((_, idx) => `level${idx + 1}`).join('/');
      const templatePath = await createTemplateWithFunc(`depth-test_${i}`, `_depth_${i}`, dir);
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
      expect(changes).toContain(`depth-test_${i}_${testContext.testId}_${i}`);
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
    await createTemplateWithFunc(`sql`, '_watch_sql_only');

    await new Promise(resolve => setTimeout(resolve, 500));
    watcher.close();

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(`sql_${testContext.testId}_1`);
  });

  it('should handle multiple template changes simultaneously', async () => {
    const client = await connect();
    const manager = await TemplateManager.create(testContext.testDir);
    const changes = new Set<string>();
    const count = 5;

    const watcher = await manager.watch();
    await new Promise(resolve => setTimeout(resolve, 100));
    manager.on('templateChanged', template => {
      changes.add(template.name);
    });

    // Create multiple templates simultaneously

    try {
      await createTemplateWithFunc(`rapid_test_1`, '_batch_changes_1');
      await createTemplateWithFunc(`rapid_test_2`, '_batch_changes_2');
      await createTemplateWithFunc(`rapid_test_3`, '_batch_changes_3');
      await createTemplateWithFunc(`rapid_test_4`, '_batch_changes_4', 'deep');
      await createTemplateWithFunc(`rapid_test_5`, '_batch_changes_5', 'deep/nested');
    } catch (error) {
      console.error('Error creating templates:', error);
      throw error;
    }
    // Give enough time for all changes to be detected
    await new Promise(resolve => setTimeout(resolve, count * 100 * 1.1));
    watcher.close();

    expect(changes.size).toBe(count); // Should detect all 5 templates
    for (let i = 1; i <= count; i++) {
      expect(changes.has(`rapid_test_${i}_${testContext.testId}_${i}`)).toBe(true);
    }

    // Verify all templates were processed

    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const res = await client.query(`SELECT proname FROM pg_proc WHERE proname LIKE $1`, [
        `${testContext.testFunctionName}_batch_changes_%`,
      ]);
      // expect(res).toBe('');
      expect(res.rows).toHaveLength(count);
    } catch (error) {
      console.error('Error querying functions:', error);
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
        createTemplateWithFunc(`bulk_${i + 1}`, `_bulk_${i + 1}`)
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
    await createTemplateWithFunc(`before-dispose`, 'before_dispose');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dispose and verify cleanup
    manager[Symbol.dispose]();

    // Try creating template after disposal
    await createTemplateWithFunc(`after-dispose`, 'after_dispose');
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(`before-dispose_${testContext.testId}_1`);
  });

  it('should auto-cleanup with using statement', async () => {
    const changes: string[] = [];

    await (async () => {
      using manager = await TemplateManager.create(testContext.testDir);

      manager.on('templateChanged', template => {
        changes.push(template.name);
      });

      await manager.watch();
      await createTemplateWithFunc(`during-scope`, 'during_scope');
      await new Promise(resolve => setTimeout(resolve, 100));
    })();

    // After scope exit, create another template
    await createTemplateWithFunc(`after-scope`, 'after_scope');
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(`during-scope_${testContext.testId}_1`);
  });

  it('should not process unchanged templates', async () => {
    const templatePath = await createTemplateWithFunc(
      `initial_will_remain_unchanged`,
      'unchanged_tmpl'
    );
    const manager = await TemplateManager.create(testContext.testDir);
    await manager.watch();

    // First processing
    await manager.processTemplates({ apply: true });

    // Get the status after first processing
    const statusAfterFirstRun = await manager.getTemplateStatus(templatePath);

    const changes: string[] = [];
    manager.on('templateChanged', template => {
      changes.push(template.name);
    });

    // Process again without changes
    await manager.processTemplates({ apply: true });

    // Get status after second run
    const statusAfterSecondRun = await manager.getTemplateStatus(templatePath);

    expect(changes).toHaveLength(0);
    expect(statusAfterSecondRun.buildState.lastBuildHash).toBe(
      statusAfterFirstRun.buildState.lastBuildHash
    );
    expect(statusAfterSecondRun.buildState.lastAppliedHash).toBe(
      statusAfterFirstRun.buildState.lastAppliedHash
    );
  });

  it('should only process modified templates in batch', async () => {
    // Create two templates
    const template1 = await createTemplateWithFunc(`modified_tmpl_1`, 'mod_1');
    await createTemplateWithFunc(`modified_tmpl_2`, 'mod_2');

    const manager = await TemplateManager.create(testContext.testDir);

    // First processing of both
    await manager.processTemplates({ apply: true });

    const changes: string[] = [];
    manager.on('templateChanged', template => {
      changes.push(template.name);
    });

    // Modify only template1
    try {
      await fs.writeFile(template1, `${await fs.readFile(template1, 'utf-8')}\n-- Modified`);
    } catch (error) {
      console.error('Test: Error modifying template:', error);
      throw error;
    }
    // Process both templates again
    await manager.processTemplates({ apply: true });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(`modified_tmpl_1_${testContext.testId}_1`);
  });

  it('should correctly update local buildlog on apply', async () => {
    const templatePath = await createTemplateWithFunc(`buildlog`, '_buildlog');
    const manager = await TemplateManager.create(testContext.testDir);
    const localBuildlogPath = join(testContext.testDir, '.buildlog-test.local.json');

    // Initial apply
    await manager.processTemplates({ apply: true });

    const initialLog = JSON.parse(await fs.readFile(localBuildlogPath, 'utf-8'));
    const relPath = relative(testContext.testDir, templatePath);
    const initialHash = initialLog.templates[relPath].lastAppliedHash;
    const initialContent = await fs.readFile(templatePath, 'utf-8');
    expect(initialHash).toBeDefined();

    // Modify template
    await fs.writeFile(templatePath, `${initialContent}\n-- Modified`);
    await new Promise(resolve => setTimeout(resolve, 100));

    const changedContent = await fs.readFile(templatePath, 'utf-8');

    // Second apply
    await manager.processTemplates({ apply: true });
    await new Promise(resolve => setTimeout(resolve, 100));

    const updatedLog = JSON.parse(await fs.readFile(localBuildlogPath, 'utf-8'));
    const newHash = updatedLog.templates[relPath].lastAppliedHash;

    const manualMd5 = await calculateMD5(changedContent);

    expect(newHash).toBeDefined();
    expect(newHash).toBe(manualMd5);
    expect(newHash).not.toBe(initialHash);
  });

  it('should skip apply if template hash matches local buildlog', async () => {
    const templatePath = await createTemplateWithFunc(`skip`, '_skip_apply');
    const manager = await TemplateManager.create(testContext.testDir);
    const localBuildlogPath = join(testContext.testDir, '.buildlog-test.local.json');

    // Initial apply
    await manager.processTemplates({ apply: true });

    const initialLog = JSON.parse(await fs.readFile(localBuildlogPath, 'utf-8'));
    const relPath = relative(testContext.testDir, templatePath);
    const initialHash = initialLog.templates[relPath].lastAppliedHash;
    const initialDate = initialLog.templates[relPath].lastAppliedDate;

    // Wait a bit to ensure timestamp would be different
    await new Promise(resolve => setTimeout(resolve, 100));

    // Apply again without changes
    await manager.processTemplates({ apply: true });

    const updatedLog = JSON.parse(await fs.readFile(localBuildlogPath, 'utf-8'));

    // Hash and date should remain exactly the same since no changes were made
    expect(updatedLog.templates[relPath].lastAppliedHash).toBe(initialHash);
    expect(updatedLog.templates[relPath].lastAppliedDate).toBe(initialDate);
  });

  it('should not reapply unchanged templates in watch mode', async () => {
    // Create multiple templates
    const templates = await Promise.all([
      createTemplateWithFunc(`watch-stable_1`, '_watch_1'),
      createTemplateWithFunc(`watch-stable_2`, '_watch_2'),
    ]);

    const manager = await TemplateManager.create(testContext.testDir);
    const applied: string[] = [];
    const changed: string[] = [];

    manager.on('templateChanged', template => {
      changed.push(template.name);
    });

    manager.on('templateApplied', template => {
      applied.push(template.name);
    });

    // First watch session
    const watcher1 = await manager.watch();
    await new Promise(resolve => setTimeout(resolve, 100));
    await watcher1.close();

    // Record initial state
    const initialApplied = [...applied];
    const initialChanged = [...changed];
    applied.length = 0;
    changed.length = 0;

    // Second watch session without any changes
    const watcher2 = await manager.watch();
    await new Promise(resolve => setTimeout(resolve, 100));
    await watcher2.close();

    expect(initialApplied).toHaveLength(2); // First run should apply both
    expect(initialChanged).toHaveLength(2); // First run should detect both
    expect(applied).toHaveLength(0); // Second run should apply none
    expect(changed).toHaveLength(0); // Second run should detect none

    // Verify the buildlog state
    const localBuildlogPath = join(testContext.testDir, '.buildlog-test.local.json');
    const buildLog = JSON.parse(await fs.readFile(localBuildlogPath, 'utf-8'));

    for (const templatePath of templates) {
      const relPath = relative(testContext.testDir, templatePath);
      const content = await fs.readFile(templatePath, 'utf-8');
      const hash = await calculateMD5(content);
      expect(buildLog.templates[relPath].lastAppliedHash).toBe(hash);
    }
  });

  it('should process unapplied templates on startup', async () => {
    // Create template but don't process it
    await createTemplateWithFunc(`startup-test`, '_startup_test');

    // Create a new manager instance
    const manager = await TemplateManager.create(testContext.testDir);

    const changes: string[] = [];
    const applied: string[] = [];

    manager.on('templateChanged', t => changes.push(t.name));
    manager.on('templateApplied', t => applied.push(t.name));

    // Start watching - this should process the template
    await manager.watch();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(changes).toHaveLength(1);
    expect(applied).toHaveLength(1);
    expect(changes[0]).toBe(`startup-test_${testContext.testId}_1`);
    expect(applied[0]).toBe(`startup-test_${testContext.testId}_1`);
  });

  it('should handle error state transitions correctly', async () => {
    const templatePath = await createTemplateWithFunc(`error-state`, '_error_test');
    const manager = await TemplateManager.create(testContext.testDir);

    const states: Array<{ type: string; error?: string }> = [];

    manager.on('templateChanged', () => states.push({ type: 'changed' }));
    manager.on('templateApplied', () => states.push({ type: 'applied' }));
    manager.on('templateError', ({ error }) =>
      states.push({ type: 'error', error: String(error) })
    );

    // First apply should succeed
    await manager.processTemplates({ apply: true });

    // Modify template to be invalid
    await fs.writeFile(templatePath, 'INVALID SQL;');
    await manager.processTemplates({ apply: true });

    // Fix template with valid SQL
    await fs.writeFile(
      templatePath,
      `CREATE OR REPLACE FUNCTION ${testContext.testFunctionName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`
    );
    await manager.processTemplates({ apply: true });

    expect(states).toEqual([
      { type: 'changed' },
      { type: 'applied' },
      { type: 'changed' },
      { type: 'error', error: expect.stringMatching(/syntax error/) },
      { type: 'changed' },
      { type: 'applied' },
    ]);
  });

  it('should maintain correct state through manager restarts', async () => {
    const templatePath = await createTemplateWithFunc(`restart-test`, 'restart_test');

    // First manager instance
    const manager1 = await TemplateManager.create(testContext.testDir);
    await manager1.processTemplates({ apply: true });

    // Get initial state
    const status1 = await manager1.getTemplateStatus(templatePath);
    const initialHash = status1.buildState.lastAppliedHash;

    // Modify template
    await fs.writeFile(templatePath, `${await fs.readFile(templatePath, 'utf-8')}\n-- Modified`);

    // Create new manager instance
    const manager2 = await TemplateManager.create(testContext.testDir);
    const changes: string[] = [];
    const applied: string[] = [];

    manager2.on('templateChanged', t => changes.push(t.name));
    manager2.on('templateApplied', t => applied.push(t.name));

    await manager2.watch();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify state was maintained and change was detected
    const status2 = await manager2.getTemplateStatus(templatePath);
    expect(status2.buildState.lastAppliedHash).not.toBe(initialHash);
    expect(changes).toContain(`restart-test_${testContext.testId}_1`);
    expect(applied).toContain(`restart-test_${testContext.testId}_1`);
  });

  it('should properly format and propagate error messages', async () => {
    const templatePath = await createTemplateWithFunc(`error-format`, 'error_format');
    const manager = await TemplateManager.create(testContext.testDir);

    const errors: Array<{ error: unknown }> = [];
    manager.on('templateError', err => errors.push(err));

    // Create invalid SQL
    await fs.writeFile(templatePath, 'SELECT * FROM nonexistent_table;');

    await manager.processTemplates({ apply: true });

    expect(errors).toHaveLength(1);
    const error = errors[0]?.error;
    expect(typeof error).toBe('string');
    expect(error).not.toMatch(/\[object Object\]/);
    expect(error).toMatch(/relation.*does not exist/i);
  });
});
