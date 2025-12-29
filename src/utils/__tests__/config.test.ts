/**
 * Tests for getConfig validation with Zod schemas.
 *
 * NOTE: This test file uses vi.unmock to override the global mocks in vitest.setup.ts
 * because we need to test the actual getConfig implementation, not the mocked version.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Unmock both logger and config to test actual implementation
vi.unmock('../logger.js');
vi.unmock('../config.js');

// Must dynamically import after unmocking to get the real implementations
const { getConfig, clearConfigCache } = await import('../config.js');

describe('getConfig validation', () => {
  const tempDirs: string[] = [];
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Clear all state
    clearConfigCache();
    // Spy on console.log to capture logger output (noop implementation)
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  afterAll(async () => {
    // Clean up all temp directories
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  async function createTestDir(options?: { createTemplateDir?: boolean }): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'srtd-config-test-'));
    tempDirs.push(dir);
    // By default, create the template directory to avoid "missing template dir" warnings
    // unless explicitly opted out
    if (options?.createTemplateDir !== false) {
      await fs.mkdir(path.join(dir, 'supabase', 'migrations-templates'), { recursive: true });
    }
    return dir;
  }

  describe('malformed JSON handling', () => {
    it('returns default config and logs warning when config file contains malformed JSON', async () => {
      const testDir = await createTestDir();
      const configPath = path.join(testDir, 'srtd.config.json');
      await fs.writeFile(configPath, '{ invalid json }');

      const { config, warnings } = await getConfig(testDir);

      // Should return default config
      expect(config.filter).toBe('**/*.sql');
      expect(config.wipIndicator).toBe('.wip');
      expect(config.wrapInTransaction).toBe(true);

      // Should have logged a warning (logger.warn uses console.log)
      const logOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logOutput).toContain('Invalid JSON');

      // Should record the warning
      expect(warnings).toHaveLength(1);
      expect(warnings[0].source).toBe('config');
      expect(warnings[0].type).toBe('parse');
      expect(warnings[0].message).toContain('Invalid JSON');
    });
  });

  describe('partial config handling', () => {
    it('merges partial config with defaults and validates the result', async () => {
      const testDir = await createTestDir();
      const configPath = path.join(testDir, 'srtd.config.json');
      await fs.writeFile(configPath, JSON.stringify({ filter: '*.sql' }));

      const { config, warnings } = await getConfig(testDir);

      // Should merge with defaults - partial config overrides defaults
      expect(config.filter).toBe('*.sql');
      expect(config.wipIndicator).toBe('.wip');
      expect(config.wrapInTransaction).toBe(true);

      // Should NOT log any warnings for valid partial config
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Should NOT record any warnings
      expect(warnings).toHaveLength(0);
    });
  });

  describe('invalid schema handling', () => {
    it('returns default config and logs warning when schema validation fails (filter is number not string)', async () => {
      const testDir = await createTestDir();
      const configPath = path.join(testDir, 'srtd.config.json');
      // Invalid: filter should be string, not number
      await fs.writeFile(configPath, JSON.stringify({ filter: 12345 }));

      const { config, warnings } = await getConfig(testDir);

      // Should return default config (not the invalid one)
      expect(config.filter).toBe('**/*.sql');
      expect(config.wipIndicator).toBe('.wip');

      // Should have logged a warning
      const logOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logOutput).toContain('Invalid config schema');
      expect(logOutput).toContain('filter');

      // Should record the validation warning
      expect(warnings).toHaveLength(1);
      expect(warnings[0].source).toBe('config');
      expect(warnings[0].type).toBe('validation');
      expect(warnings[0].message).toContain('filter');
    });

    it('returns default config and logs warning when wrapInTransaction is string not boolean', async () => {
      const testDir = await createTestDir();
      const configPath = path.join(testDir, 'srtd.config.json');
      // Invalid: wrapInTransaction should be boolean, not string
      await fs.writeFile(configPath, JSON.stringify({ wrapInTransaction: 'yes' }));

      const { config, warnings } = await getConfig(testDir);

      // Should return default config
      expect(config.wrapInTransaction).toBe(true);

      // Should record the validation warning
      expect(warnings).toHaveLength(1);
      expect(warnings[0].source).toBe('config');
      expect(warnings[0].type).toBe('validation');
      expect(warnings[0].message).toContain('wrapInTransaction');
    });
  });

  describe('valid config handling', () => {
    it('returns merged config without warning when config is valid', async () => {
      const testDir = await createTestDir();
      const configPath = path.join(testDir, 'srtd.config.json');
      await fs.writeFile(
        configPath,
        JSON.stringify({
          filter: 'custom/*.sql',
          wipIndicator: '.draft',
          wrapInTransaction: false,
        })
      );

      const { config, warnings } = await getConfig(testDir);

      // Should return merged config with custom values
      expect(config.filter).toBe('custom/*.sql');
      expect(config.wipIndicator).toBe('.draft');
      expect(config.wrapInTransaction).toBe(false);
      // Should use defaults for unspecified values
      expect(config.banner).toBe(
        'You very likely **DO NOT** want to manually edit this generated file.'
      );

      // Should NOT log any warnings
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Should NOT record any warnings
      expect(warnings).toHaveLength(0);
    });
  });

  describe('file not found handling', () => {
    it('returns default config without warning when config file does not exist', async () => {
      const testDir = await createTestDir();

      const { config, warnings } = await getConfig(testDir);

      // Should return default config
      expect(config.filter).toBe('**/*.sql');

      // Should NOT log a warning for missing file (this is expected)
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Should NOT record any warnings
      expect(warnings).toHaveLength(0);
    });
  });
});
