import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ROOT } from '../__tests__/vitest.setup.js';
import { DEFAULT_PG_CONNECTION } from '../constants.js';
import { getConfig } from './config.js';

describe('config', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('should call getConfig with the correct path', async () => {
    const mockGetConfig = vi.mocked(getConfig);
    await getConfig(TEST_ROOT);
    expect(mockGetConfig).toHaveBeenCalledWith(TEST_ROOT);
  });

  it('should return mocked test config values', async () => {
    const { config, warnings } = await getConfig(TEST_ROOT);
    expect(config).toEqual({
      wipIndicator: '.wip',
      filter: '**/*.sql',
      templateDir: 'test-templates',
      migrationDir: 'test-migrations',
      buildLog: '.buildlog-test.json',
      localBuildLog: '.buildlog-test.local.json',
      pgConnection: process.env.POSTGRES_URL || DEFAULT_PG_CONNECTION,
      banner: 'Test banner',
      footer: 'Test footer',
      wrapInTransaction: true,
    });
    expect(warnings).toEqual([]);
  });

  it('should handle nested paths correctly', async () => {
    const nestedPath = path.join(TEST_ROOT, 'nested', 'config');
    const { config } = await getConfig(nestedPath);
    expect(config.templateDir).toBe('test-templates');
  });
});

// Test saveConfig with real file I/O in isolation
// This block unmocks the config module to test the real implementation
describe('config file operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Each test needs a fresh temp dir and fresh module instance
    vi.doUnmock('./config.js');
    vi.resetModules();
    tempDir = path.join(
      os.tmpdir(),
      `srtd-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should write config file with correct format', async () => {
    const { saveConfig } = await import('./config.js');

    await saveConfig(tempDir, { templateDir: 'custom' });

    const content = await fs.readFile(path.join(tempDir, 'srtd.config.json'), 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.templateDir).toBe('custom');
    expect(content.endsWith('\n')).toBe(true);
  });

  it('should reset config to defaults', async () => {
    const { saveConfig, resetConfig } = await import('./config.js');

    // First save a custom config
    await saveConfig(tempDir, { templateDir: 'custom', migrationDir: 'custom-migrations' });

    // Then reset it
    await resetConfig(tempDir);

    // Verify the file exists and has default values
    const content = await fs.readFile(path.join(tempDir, 'srtd.config.json'), 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.templateDir).toBe('supabase/migrations-templates');
    expect(parsed.migrationDir).toBe('supabase/migrations');
  });

  // Note: clearBuildLogs tests removed - that function moved to Orchestrator/StateService

  it('should read config from file when it exists', async () => {
    // Create a config file
    const configContent = {
      templateDir: 'my-templates',
      migrationDir: 'my-migrations',
      wipIndicator: '.draft',
    };
    await fs.writeFile(path.join(tempDir, 'srtd.config.json'), JSON.stringify(configContent));

    // Fresh import after unmocking
    const { getConfig } = await import('./config.js');
    const { config } = await getConfig(tempDir);

    expect(config.templateDir).toBe('my-templates');
    expect(config.migrationDir).toBe('my-migrations');
    expect(config.wipIndicator).toBe('.draft');
    // Default values should also be present
    expect(config.filter).toBe('**/*.sql');
  });

  it('should return default config when file does not exist', async () => {
    // Fresh import after unmocking
    const { getConfig } = await import('./config.js');
    const { config } = await getConfig(tempDir);

    expect(config.templateDir).toBe('supabase/migrations-templates');
    expect(config.migrationDir).toBe('supabase/migrations');
    expect(config.wipIndicator).toBe('.wip');
  });

  it('should return warning when template directory does not exist', async () => {
    // Create a config file pointing to a non-existent template directory
    const configContent = {
      templateDir: 'non-existent-templates',
      migrationDir: 'migrations',
    };
    await fs.writeFile(path.join(tempDir, 'srtd.config.json'), JSON.stringify(configContent));

    // Fresh import after unmocking
    const { getConfig } = await import('./config.js');
    const { config, warnings } = await getConfig(tempDir);

    expect(config.templateDir).toBe('non-existent-templates');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.source === 'config' && w.message.includes('template'))).toBe(true);
  });

  it('should not warn when template directory exists', async () => {
    // Create the template directory
    const templateDir = path.join(tempDir, 'existing-templates');
    await fs.mkdir(templateDir, { recursive: true });

    // Create a config file pointing to it
    const configContent = {
      templateDir: 'existing-templates',
      migrationDir: 'migrations',
    };
    await fs.writeFile(path.join(tempDir, 'srtd.config.json'), JSON.stringify(configContent));

    // Fresh import after unmocking
    const { getConfig } = await import('./config.js');
    const { warnings } = await getConfig(tempDir);

    // Should have no warnings about template directory
    expect(warnings.filter(w => w.message.includes('template'))).toHaveLength(0);
  });
});
