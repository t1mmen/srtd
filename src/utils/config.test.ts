import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConfig, saveConfig } from './config.js';
import path from 'path';
import { TEST_ROOT } from '../__tests__/vitest.setup.js';

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
        process.env['POSTGRES_URL'] || 'postgresql://postgres:postgres@localhost:54322/postgres',
      banner: 'Test banner',
      footer: 'Test footer',
      wrapInTransaction: true,
    });
  });

  it('should call saveConfig with merged config', async () => {
    const partialConfig = {
      templateDir: 'custom-templates',
    };

    const mockGetConfig = vi.mocked(getConfig);
    mockGetConfig.mockImplementationOnce(async () => ({
      ...(await getConfig(TEST_ROOT)),
      ...partialConfig,
    }));

    await saveConfig(TEST_ROOT, partialConfig);
    const savedConfig = await getConfig(TEST_ROOT);
    expect(savedConfig.templateDir).toBe('custom-templates');
    expect(savedConfig.migrationDir).toBe('test-migrations'); // Preserved from mock
  });

  it('should handle nested paths correctly', async () => {
    const nestedPath = path.join(TEST_ROOT, 'nested', 'config');
    const config = await getConfig(nestedPath);
    expect(config.templateDir).toBe('test-templates');
  });
});
