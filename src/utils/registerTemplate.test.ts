import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TestResource } from '../__tests__/helpers/TestResource.js';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { getConfig } from '../utils/config.js';
import { registerTemplate } from '../utils/registerTemplate.js';

describe('registerTemplate', () => {
  it('successfully registers a valid template 🎯', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    const templateContent = `
      CREATE FUNCTION test()
      RETURNS void AS $$
      BEGIN
        NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;
    const templatePath = await resources.createTemplate(`success.sql`, templateContent);
    const config = await getConfig(resources.testDir);

    await registerTemplate(templatePath, resources.testDir);

    const buildLog = JSON.parse(
      await fs.readFile(path.join(resources.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(resources.testDir, templatePath);

    expect(buildLog.templates[relPath]).toBeDefined();
    expect(buildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(templateContent));
    expect(buildLog.templates[relPath].lastBuildDate).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
    expect(buildLog.templates[relPath].lastMigrationFile).toBe('');
  });

  it('prevents registering templates outside templateDir 🔒', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    // Try to register a template from outside the configured template directory
    const outsideContent = 'SELECT 1;';
    const outsidePath = path.join(resources.testDir, 'outside.sql');
    await fs.writeFile(outsidePath, outsideContent);

    await expect(registerTemplate(outsidePath, resources.testDir)).rejects.toThrow(
      /Template in wrong directory/
    );

    // Also try with a path that looks like it's in templateDir but isn't
    const sneakyPath = path.join(resources.testDir, 'fake-test-templates', 'sneaky.sql');
    await fs.mkdir(path.dirname(sneakyPath), { recursive: true });
    await fs.writeFile(sneakyPath, outsideContent);

    await expect(registerTemplate(sneakyPath, resources.testDir)).rejects.toThrow(
      /Template in wrong directory/
    );
  });

  it('handles templates in nested directories 📂', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    const templatePath = await resources.createTemplate(
      'nested.sql',
      'SELECT 1;',
      'deep/nested/dir'
    );
    await registerTemplate(templatePath, resources.testDir);

    const config = await getConfig(resources.testDir);
    const buildLog = JSON.parse(
      await fs.readFile(path.join(resources.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(resources.testDir, templatePath);

    expect(buildLog.templates[relPath]).toBeDefined();
  });

  it('updates existing template registration 🔄', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    const templatePath = await resources.createTemplate('update.sql', 'SELECT 1;');
    const config = await getConfig(resources.testDir);

    await registerTemplate(templatePath, resources.testDir);

    const initialBuildLog = JSON.parse(
      await fs.readFile(path.join(resources.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(resources.testDir, templatePath);
    const initialHash = initialBuildLog.templates[relPath].lastBuildHash;

    const newContent = 'SELECT 2;';
    await fs.writeFile(templatePath, newContent);
    await registerTemplate(templatePath, resources.testDir);

    const updatedBuildLog = JSON.parse(
      await fs.readFile(path.join(resources.testDir, config.buildLog), 'utf-8')
    );
    expect(updatedBuildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(newContent));
    expect(updatedBuildLog.templates[relPath].lastBuildHash).not.toBe(initialHash);
  });

  it('handles empty template files 📄', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    const templatePath = await resources.createTemplate('empty.sql', '');
    await registerTemplate(templatePath, resources.testDir);

    const config = await getConfig(resources.testDir);
    const buildLog = JSON.parse(
      await fs.readFile(path.join(resources.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(resources.testDir, templatePath);
    expect(buildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(''));
  });

  it('handles large template files efficiently 📚', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    const largeContent = `
      SELECT ${`'x'`.repeat(100 * 1024)};
    `;
    const templatePath = await resources.createTemplate('large.sql', largeContent);

    const startTime = Date.now();
    await registerTemplate(templatePath, resources.testDir);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000);

    const config = await getConfig(resources.testDir);
    const buildLog = JSON.parse(
      await fs.readFile(path.join(resources.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(resources.testDir, templatePath);
    expect(buildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(largeContent));
  });

  it('gracefully handles non-existent templates 🚫', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    const config = await getConfig(resources.testDir);
    const nonExistentPath = path.join(resources.testDir, config.templateDir, 'nope.sql');
    await expect(registerTemplate(nonExistentPath, resources.testDir)).rejects.toThrow(
      /Template.*not found/
    );
  });

  it('fails gracefully with filesystem errors 💥', async () => {
    using resources = new TestResource({ prefix: 'register-template' });
    await resources.setup();

    const templatePath = await resources.createTemplate('permission.sql', 'SELECT 1;', 'locked');
    const templateDir = path.dirname(templatePath);

    try {
      await fs.chmod(templateDir, 0o000);
      await expect(registerTemplate(templatePath, resources.testDir)).rejects.toThrow();
    } finally {
      await fs.chmod(templateDir, 0o755);
    }
  });
});
