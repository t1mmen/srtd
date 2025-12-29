import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('../utils/fileExists.js', () => ({
  fileExists: vi.fn(),
}));
vi.mock('../services/DatabaseService.js');

import { DatabaseService } from '../services/DatabaseService.js';
import type { CLIConfig } from '../types.js';
// Import the module we're testing (will fail until implemented)
import {
  checkBuildLogValid,
  checkConfigExists,
  checkConfigSchemaValid,
  checkDatabaseConnection,
  checkLocalBuildLogValid,
  checkMigrationDirExists,
  checkMigrationDirWritable,
  checkTemplateCount,
  checkTemplateDirExists,
  checkTemplateDirReadable,
  type DoctorCheckResult,
  runAllChecks,
} from '../utils/doctorChecks.js';
import { fileExists } from '../utils/fileExists.js';
import type { ValidationWarning } from '../utils/schemas.js';

describe('doctorChecks', () => {
  const mockConfig: CLIConfig = {
    templateDir: 'supabase/migrations-templates',
    migrationDir: 'supabase/migrations',
    wipIndicator: '.wip',
    buildLog: 'supabase/migrations-templates/.srtd.buildlog.json',
    localBuildLog: 'supabase/migrations-templates/.srtd.buildlog.local.json',
    pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
    filter: '**/*.sql',
    banner: 'Generated file',
    footer: '',
    wrapInTransaction: true,
  };

  const projectRoot = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('DoctorCheckResult interface', () => {
    it('has expected shape with name, passed, and optional message', () => {
      const passResult: DoctorCheckResult = {
        name: 'Test Check',
        passed: true,
      };
      expect(passResult.name).toBe('Test Check');
      expect(passResult.passed).toBe(true);
      expect(passResult.message).toBeUndefined();

      const failResult: DoctorCheckResult = {
        name: 'Test Check',
        passed: false,
        message: 'Something went wrong',
      };
      expect(failResult.passed).toBe(false);
      expect(failResult.message).toBe('Something went wrong');
    });
  });

  describe('checkConfigExists', () => {
    it('returns passed when srtd.config.json exists', async () => {
      vi.mocked(fileExists).mockResolvedValue(true);

      const result = await checkConfigExists(projectRoot);

      expect(result.name).toBe('Config file exists');
      expect(result.passed).toBe(true);
      expect(result.message).toBeUndefined();
      expect(fileExists).toHaveBeenCalledWith(path.join(projectRoot, 'srtd.config.json'));
    });

    it('returns failed when srtd.config.json does not exist', async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const result = await checkConfigExists(projectRoot);

      expect(result.name).toBe('Config file exists');
      expect(result.passed).toBe(false);
      expect(result.message).toContain('srtd.config.json not found');
    });
  });

  describe('checkConfigSchemaValid', () => {
    it('returns passed when no config warnings', async () => {
      const warnings: ValidationWarning[] = [];

      const result = await checkConfigSchemaValid(warnings);

      expect(result.name).toBe('Config schema valid');
      expect(result.passed).toBe(true);
    });

    it('returns failed when config has validation warnings', async () => {
      const warnings: ValidationWarning[] = [
        {
          source: 'config',
          type: 'validation',
          message: 'Invalid field: foo',
        },
      ];

      const result = await checkConfigSchemaValid(warnings);

      expect(result.name).toBe('Config schema valid');
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Invalid field: foo');
    });

    it('returns failed when config has parse warnings', async () => {
      const warnings: ValidationWarning[] = [
        {
          source: 'config',
          type: 'parse',
          message: 'Invalid JSON syntax',
        },
      ];

      const result = await checkConfigSchemaValid(warnings);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Invalid JSON');
    });
  });

  describe('checkTemplateDirExists', () => {
    it('returns passed when template directory exists', async () => {
      vi.mocked(fileExists).mockResolvedValue(true);

      const result = await checkTemplateDirExists(projectRoot, mockConfig);

      expect(result.name).toBe('Template directory exists');
      expect(result.passed).toBe(true);
      expect(fileExists).toHaveBeenCalledWith(path.join(projectRoot, mockConfig.templateDir));
    });

    it('returns failed when template directory does not exist', async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const result = await checkTemplateDirExists(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain(mockConfig.templateDir);
    });
  });

  describe('checkMigrationDirExists', () => {
    it('returns passed when migration directory exists', async () => {
      vi.mocked(fileExists).mockResolvedValue(true);

      const result = await checkMigrationDirExists(projectRoot, mockConfig);

      expect(result.name).toBe('Migration directory exists');
      expect(result.passed).toBe(true);
    });

    it('returns failed when migration directory does not exist', async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const result = await checkMigrationDirExists(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain(mockConfig.migrationDir);
    });
  });

  describe('checkTemplateDirReadable', () => {
    it('returns passed when template directory is readable', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['template1.sql'] as unknown as Awaited<
        ReturnType<typeof fs.readdir>
      >);

      const result = await checkTemplateDirReadable(projectRoot, mockConfig);

      expect(result.name).toBe('Template directory readable');
      expect(result.passed).toBe(true);
    });

    it('returns failed when template directory is not readable', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

      const result = await checkTemplateDirReadable(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Permission denied');
    });
  });

  describe('checkMigrationDirWritable', () => {
    it('returns passed when migration directory is writable', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await checkMigrationDirWritable(projectRoot, mockConfig);

      expect(result.name).toBe('Migration directory writable');
      expect(result.passed).toBe(true);
      // Should write and then delete the test file
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('returns failed when migration directory is not writable', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Read-only file system'));

      const result = await checkMigrationDirWritable(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Read-only');
    });
  });

  describe('checkBuildLogValid', () => {
    it('returns passed when build log is valid', async () => {
      const validBuildLog = JSON.stringify({
        version: '1.0.0',
        lastTimestamp: '20231201120000',
        templates: {},
      });
      vi.mocked(fs.readFile).mockResolvedValue(validBuildLog);

      const result = await checkBuildLogValid(projectRoot, mockConfig);

      expect(result.name).toBe('Build log valid');
      expect(result.passed).toBe(true);
    });

    it('returns passed when build log does not exist (optional file)', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const result = await checkBuildLogValid(projectRoot, mockConfig);

      expect(result.passed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('returns failed when build log has invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json');

      const result = await checkBuildLogValid(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('returns failed when build log has invalid schema', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ foo: 'bar' }));

      const result = await checkBuildLogValid(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
    });
  });

  describe('checkLocalBuildLogValid', () => {
    it('returns passed when local build log is valid', async () => {
      const validBuildLog = JSON.stringify({
        version: '1.0.0',
        lastTimestamp: '20231201120000',
        templates: {},
      });
      vi.mocked(fs.readFile).mockResolvedValue(validBuildLog);

      const result = await checkLocalBuildLogValid(projectRoot, mockConfig);

      expect(result.name).toBe('Local build log valid');
      expect(result.passed).toBe(true);
    });

    it('returns passed when local build log does not exist (optional file)', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const result = await checkLocalBuildLogValid(projectRoot, mockConfig);

      expect(result.passed).toBe(true);
    });

    it('returns failed when local build log has invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json');

      const result = await checkLocalBuildLogValid(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('returns failed when local build log has invalid schema', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ foo: 'bar' }));

      const result = await checkLocalBuildLogValid(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
    });
  });

  describe('checkDatabaseConnection', () => {
    it('returns passed when database connection succeeds', async () => {
      const mockDb = {
        testConnection: vi.fn().mockResolvedValue(true),
        dispose: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(DatabaseService.fromConfig).mockReturnValue(mockDb as unknown as DatabaseService);

      const result = await checkDatabaseConnection(mockConfig);

      expect(result.name).toBe('Database connection');
      expect(result.passed).toBe(true);
      expect(mockDb.dispose).toHaveBeenCalled();
    });

    it('returns failed when database connection fails', async () => {
      const mockDb = {
        testConnection: vi.fn().mockResolvedValue(false),
        dispose: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(DatabaseService.fromConfig).mockReturnValue(mockDb as unknown as DatabaseService);

      const result = await checkDatabaseConnection(mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Connection');
    });

    it('returns failed when database connection throws', async () => {
      const mockDb = {
        testConnection: vi.fn().mockRejectedValue(new Error('Connection refused')),
        dispose: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(DatabaseService.fromConfig).mockReturnValue(mockDb as unknown as DatabaseService);

      const result = await checkDatabaseConnection(mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('refused');
    });

    it('respects timeout for slow connections', async () => {
      const mockDb = {
        testConnection: vi
          .fn()
          .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 10000))),
        dispose: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(DatabaseService.fromConfig).mockReturnValue(mockDb as unknown as DatabaseService);

      // Use fake timers to test timeout behavior
      vi.useFakeTimers();
      const resultPromise = checkDatabaseConnection(mockConfig, 100);
      vi.advanceTimersByTime(200);
      const result = await resultPromise;
      vi.useRealTimers();

      expect(result.passed).toBe(false);
      expect(result.message).toContain('timed out');
    });
  });

  describe('checkTemplateCount', () => {
    it('returns passed when at least one .sql template exists', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'template1.sql',
        'template2.sql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const result = await checkTemplateCount(projectRoot, mockConfig);

      expect(result.name).toBe('Template count');
      expect(result.passed).toBe(true);
    });

    it('returns failed when no .sql templates exist', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['readme.md'] as unknown as Awaited<
        ReturnType<typeof fs.readdir>
      >);

      const result = await checkTemplateCount(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('No SQL templates found');
    });

    it('returns failed when template directory is empty', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>
      );

      const result = await checkTemplateCount(projectRoot, mockConfig);

      expect(result.passed).toBe(false);
    });
  });

  describe('runAllChecks', () => {
    it('runs all 10 checks and returns results array', async () => {
      // Setup all mocks for passing checks
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(fs.readdir).mockResolvedValue(['template.sql'] as unknown as Awaited<
        ReturnType<typeof fs.readdir>
      >);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const mockDb = {
        testConnection: vi.fn().mockResolvedValue(true),
        dispose: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(DatabaseService.fromConfig).mockReturnValue(mockDb as unknown as DatabaseService);

      const results = await runAllChecks(projectRoot, mockConfig, []);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.name && typeof r.passed === 'boolean')).toBe(true);
    });

    it('returns correct count of passed and failed checks', async () => {
      // Setup some passing, some failing
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // config exists
        .mockResolvedValueOnce(false) // template dir missing
        .mockResolvedValueOnce(true); // migration dir exists

      vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const mockDb = {
        testConnection: vi.fn().mockResolvedValue(false),
        dispose: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(DatabaseService.fromConfig).mockReturnValue(mockDb as unknown as DatabaseService);

      const results = await runAllChecks(projectRoot, mockConfig, []);

      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;

      expect(passed + failed).toBe(10);
      expect(failed).toBeGreaterThan(0);
    });
  });
});
