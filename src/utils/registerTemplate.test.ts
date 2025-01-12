import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_ROOT } from '../__tests__/vitest.setup.js';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { getConfig } from '../utils/config.js';
import { registerTemplate } from '../utils/registerTemplate.js';

describe('registerTemplate', () => {
  const testContext = {
    testId: 0,
    testDir: '',
    templateCounter: 0,
  };

  beforeEach(async () => {
    testContext.testId = Math.floor(Math.random() * 1000000);
    testContext.testDir = path.join(TEST_ROOT, `register-template-${testContext.testId}`);
    testContext.templateCounter = 0;

    // Create test directories using config paths
    const config = await getConfig(testContext.testDir);
    await fs.mkdir(path.join(testContext.testDir, config.templateDir), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testContext.testDir, { recursive: true, force: true });
  });

  const getNextTemplateName = (prefix = 'template') => {
    testContext.templateCounter++;
    return `${prefix}_${testContext.testId}_${testContext.templateCounter}`;
  };

  const createTemplate = async (name: string, content: string, dir?: string) => {
    const config = await getConfig(testContext.testDir);
    const fullPath = dir
      ? path.join(testContext.testDir, config.templateDir, dir, name)
      : path.join(testContext.testDir, config.templateDir, name);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
      return fullPath;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  };

  it('successfully registers a valid template 🎯', async () => {
    const templateName = getNextTemplateName('success');
    const templateContent = `
      CREATE FUNCTION test()
      RETURNS void AS $$
      BEGIN
        NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;
    const templatePath = await createTemplate(`${templateName}.sql`, templateContent);
    const config = await getConfig(testContext.testDir);

    await registerTemplate(templatePath, testContext.testDir);

    const buildLog = JSON.parse(
      await fs.readFile(path.join(testContext.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(testContext.testDir, templatePath);

    expect(buildLog.templates[relPath]).toBeDefined();
    expect(buildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(templateContent));
    expect(buildLog.templates[relPath].lastBuildDate).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
    expect(buildLog.templates[relPath].lastMigrationFile).toBe('');
  });

  it('prevents registering templates outside templateDir 🔒', async () => {
    // Try to register a template from outside the configured template directory
    const outsideContent = 'SELECT 1;';
    const outsidePath = path.join(testContext.testDir, 'outside.sql');
    await fs.writeFile(outsidePath, outsideContent);

    await expect(registerTemplate(outsidePath, testContext.testDir)).rejects.toThrow(
      /Template in wrong directory/
    );

    // Also try with a path that looks like it's in templateDir but isn't
    const sneakyPath = path.join(testContext.testDir, 'fake-test-templates', 'sneaky.sql');
    await fs.mkdir(path.dirname(sneakyPath), { recursive: true });
    await fs.writeFile(sneakyPath, outsideContent);

    await expect(registerTemplate(sneakyPath, testContext.testDir)).rejects.toThrow(
      /Template in wrong directory/
    );
  });

  it('handles templates in nested directories 📂', async () => {
    const templateName = getNextTemplateName('nested');
    const templatePath = await createTemplate(
      `${templateName}.sql`,
      'SELECT 1;',
      'deep/nested/dir'
    );

    await registerTemplate(templatePath, testContext.testDir);

    const config = await getConfig(testContext.testDir);
    const buildLog = JSON.parse(
      await fs.readFile(path.join(testContext.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(testContext.testDir, templatePath);

    expect(buildLog.templates[relPath]).toBeDefined();
  });

  it('updates existing template registration 🔄', async () => {
    const templateName = getNextTemplateName('update');
    const templatePath = await createTemplate(`${templateName}.sql`, 'SELECT 1;');
    const config = await getConfig(testContext.testDir);

    await registerTemplate(templatePath, testContext.testDir);

    const initialBuildLog = JSON.parse(
      await fs.readFile(path.join(testContext.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(testContext.testDir, templatePath);
    const initialHash = initialBuildLog.templates[relPath].lastBuildHash;

    const newContent = 'SELECT 2;';
    await fs.writeFile(templatePath, newContent);
    await registerTemplate(templatePath, testContext.testDir);

    const updatedBuildLog = JSON.parse(
      await fs.readFile(path.join(testContext.testDir, config.buildLog), 'utf-8')
    );
    expect(updatedBuildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(newContent));
    expect(updatedBuildLog.templates[relPath].lastBuildHash).not.toBe(initialHash);
  });

  it('handles empty template files 📄', async () => {
    const templateName = getNextTemplateName('empty');
    const templatePath = await createTemplate(`${templateName}.sql`, '');

    await registerTemplate(templatePath, testContext.testDir);

    const config = await getConfig(testContext.testDir);
    const buildLog = JSON.parse(
      await fs.readFile(path.join(testContext.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(testContext.testDir, templatePath);
    expect(buildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(''));
  });

  it('handles large template files efficiently 📚', async () => {
    const templateName = getNextTemplateName('large');
    const largeContent = `
      SELECT ${`'x'`.repeat(100 * 1024)};
    `;
    const templatePath = await createTemplate(`${templateName}.sql`, largeContent);

    const startTime = Date.now();
    await registerTemplate(templatePath, testContext.testDir);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000);

    const config = await getConfig(testContext.testDir);
    const buildLog = JSON.parse(
      await fs.readFile(path.join(testContext.testDir, config.buildLog), 'utf-8')
    );
    const relPath = path.relative(testContext.testDir, templatePath);
    expect(buildLog.templates[relPath].lastBuildHash).toBe(await calculateMD5(largeContent));
  });

  it('gracefully handles non-existent templates 🚫', async () => {
    const config = await getConfig(testContext.testDir);
    const nonExistentPath = path.join(testContext.testDir, config.templateDir, 'nope.sql');
    await expect(registerTemplate(nonExistentPath, testContext.testDir)).rejects.toThrow(
      /Template.*not found/
    );
  });

  it('fails gracefully with filesystem errors 💥', async () => {
    const templateName = getNextTemplateName('permission');
    const templatePath = await createTemplate(`${templateName}.sql`, 'SELECT 1;', 'locked');
    const templateDir = path.dirname(templatePath);

    try {
      await fs.chmod(templateDir, 0o000);
      await expect(registerTemplate(templatePath, testContext.testDir)).rejects.toThrow();
    } finally {
      await fs.chmod(templateDir, 0o755);
    }
  });
});
