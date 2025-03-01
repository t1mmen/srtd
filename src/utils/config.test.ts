import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ROOT } from '../__tests__/vitest.setup.js';
import { getConfig, saveConfig } from './config.js';

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call getConfig with the correct path', async () => {
    const mockGetConfig = vi.mocked(getConfig);
    await getConfig(TEST_ROOT);
    expect(mockGetConfig).toHaveBeenCalledWith(TEST_ROOT);
  });

  it('should return mocked test config values', async () => {
    const config = await getConfig(TEST_ROOT);
    expect(config).toEqual({
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
    });
  });

  it('should save and merge with default config', async () => {
    const userConfig = {
      templateDir: 'custom/templates',
      migrationDir: 'custom/migrations',
    };

    await saveConfig(TEST_ROOT, userConfig);
    const savedContent = JSON.parse(
      await fs.readFile(path.join(TEST_ROOT, 'srtd.config.json'), 'utf-8')
    );

    expect(savedContent.templateDir).toBe('custom/templates');
    expect(savedContent.migrationDir).toBe('custom/migrations');
    expect(savedContent.wrapInTransaction).toBe(true);
  });

  it('should handle empty config object', async () => {
    await saveConfig(TEST_ROOT, {});
    const config = await getConfig(TEST_ROOT);
    expect(config.templateDir).toBe('test-templates');
  });

  it('should preserve unknown fields', async () => {
    const customConfig = {
      templateDir: 'custom',
      unknownField: 'value',
    };

    await saveConfig(TEST_ROOT, customConfig);
    const savedContent = JSON.parse(
      await fs.readFile(path.join(TEST_ROOT, 'srtd.config.json'), 'utf-8')
    );

    expect(savedContent.unknownField).toBe('value');
  });

  it('should add a newline at the end of the config file', async () => {
    await saveConfig(TEST_ROOT, { templateDir: 'custom' });
    const fileContent = await fs.readFile(path.join(TEST_ROOT, 'srtd.config.json'), 'utf-8');

    // Verify the file ends with a newline
    expect(fileContent.endsWith('\n')).toBe(true);
  });

  it('should handle nested paths correctly', async () => {
    const nestedPath = path.join(TEST_ROOT, 'nested', 'config');
    const config = await getConfig(nestedPath);
    expect(config.templateDir).toBe('test-templates');
  });
});
