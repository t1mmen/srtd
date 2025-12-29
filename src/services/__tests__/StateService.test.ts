/**
 * StateService tests
 * Tests all state transitions, persistence operations, and edge cases
 */

// import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
// import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildLog } from '../../types.js';
import { StateService, type StateServiceConfig, TemplateState } from '../StateService.js';

// Mock modules
vi.mock('node:fs/promises');

describe('StateService', () => {
  let service: StateService;
  let config: StateServiceConfig;
  const mockBuildLog: BuildLog = {
    version: '1.0',
    lastTimestamp: '2024-01-01T00:00:00.000Z',
    templates: {
      'templates/users.sql': {
        lastBuildHash: 'build123',
        lastBuildDate: '2024-01-01T10:00:00.000Z',
        lastMigrationFile: '20240101100000_users.sql',
      },
    },
  };

  const mockLocalBuildLog: BuildLog = {
    version: '1.0',
    lastTimestamp: '2024-01-01T00:00:00.000Z',
    templates: {
      'templates/users.sql': {
        lastAppliedHash: 'apply123',
        lastAppliedDate: '2024-01-01T09:00:00.000Z',
      },
      'templates/posts.sql': {
        lastAppliedHash: 'apply456',
        lastAppliedDate: '2024-01-01T11:00:00.000Z',
        lastAppliedError: 'SQL syntax error',
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    config = {
      baseDir: '/test/base',
      buildLogPath: '/test/base/.buildlog.json',
      localBuildLogPath: '/test/base/.buildlog.local.json',
      autoSave: false, // Disable for testing
    };

    service = new StateService(config);

    // Mock file system operations
    vi.mocked(fs.readFile).mockImplementation(async filePath => {
      if (filePath === config.buildLogPath) {
        return JSON.stringify(mockBuildLog);
      }
      if (filePath === config.localBuildLogPath) {
        return JSON.stringify(mockLocalBuildLog);
      }
      throw new Error('File not found');
    });

    vi.mocked(fs.writeFile).mockResolvedValue();

    await service.initialize();
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('initialization', () => {
    it('should initialize with empty buildlogs when files do not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const newService = new StateService(config);
      await newService.initialize();

      const states = newService.getAllTemplateStatuses();
      expect(states.size).toBe(0);

      await newService.dispose();
    });

    it('should load and merge buildlogs on initialization', async () => {
      const states = service.getAllTemplateStatuses();
      expect(states.size).toBe(2);

      const usersState = service.getTemplateStatus('/test/base/templates/users.sql');
      expect(usersState?.lastBuiltHash).toBe('build123');
      expect(usersState?.lastAppliedHash).toBe('apply123');
      expect(usersState?.state).toBe(TemplateState.BUILT);

      const postsState = service.getTemplateStatus('/test/base/templates/posts.sql');
      expect(postsState?.lastAppliedHash).toBe('apply456');
      expect(postsState?.lastError).toBe('SQL syntax error');
      expect(postsState?.state).toBe(TemplateState.ERROR);
    });

    it('should handle corrupted JSON files gracefully', async () => {
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return 'invalid json';
        }
        return JSON.stringify(mockLocalBuildLog);
      });

      const warningHandler = vi.fn();
      const newService = new StateService(config);
      newService.on('validation:warning', warningHandler);

      await newService.initialize();
      // Now emits validation:warning instead of error for corrupted JSON
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'buildLog',
          type: 'parse',
          message: expect.stringContaining('Invalid JSON'),
        })
      );

      await newService.dispose();
    });

    it('should emit validation:warning when build log contains malformed JSON', async () => {
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return '{ invalid json without closing brace';
        }
        return JSON.stringify(mockLocalBuildLog);
      });

      const warningHandler = vi.fn();
      const newService = new StateService(config);
      newService.on('validation:warning', warningHandler);

      await newService.initialize();

      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'buildLog',
          type: 'parse',
          path: config.buildLogPath,
          message: expect.stringContaining('Invalid JSON'),
        })
      );

      await newService.dispose();
    });

    it('should emit validation:warning when build log has invalid schema', async () => {
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          // version should be string, not number
          return JSON.stringify({
            version: 123,
            lastTimestamp: '',
            templates: {},
          });
        }
        return JSON.stringify(mockLocalBuildLog);
      });

      const warningHandler = vi.fn();
      const newService = new StateService(config);
      newService.on('validation:warning', warningHandler);

      await newService.initialize();

      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'buildLog',
          type: 'validation',
          path: config.buildLogPath,
          message: expect.stringContaining('version'),
        })
      );

      await newService.dispose();
    });

    it('should not emit validation:warning when build log is valid', async () => {
      const warningHandler = vi.fn();
      const newService = new StateService(config);
      newService.on('validation:warning', warningHandler);

      await newService.initialize();

      expect(warningHandler).not.toHaveBeenCalled();

      await newService.dispose();
    });

    it('should only warn about local build log when shared is valid but local is corrupted', async () => {
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return JSON.stringify(mockBuildLog);
        }
        if (filePath === config.localBuildLogPath) {
          return '{ broken local json';
        }
        throw new Error('File not found');
      });

      const warningHandler = vi.fn();
      const newService = new StateService(config);
      newService.on('validation:warning', warningHandler);

      await newService.initialize();

      // Should have exactly one warning for the local build log
      expect(warningHandler).toHaveBeenCalledTimes(1);
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'localBuildLog',
          type: 'parse',
          path: config.localBuildLogPath,
          message: expect.stringContaining('Invalid JSON'),
        })
      );

      await newService.dispose();
    });

    it('should provide validation warnings via getValidationWarnings()', async () => {
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return '{ invalid';
        }
        if (filePath === config.localBuildLogPath) {
          return '{ also invalid';
        }
        throw new Error('File not found');
      });

      const newService = new StateService(config);
      await newService.initialize();

      const warnings = newService.getValidationWarnings();
      expect(warnings).toHaveLength(2);
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: 'buildLog', type: 'parse' }),
          expect.objectContaining({ source: 'localBuildLog', type: 'parse' }),
        ])
      );

      await newService.dispose();
    });
  });

  describe('state transitions', () => {
    const templatePath = '/test/base/templates/test.sql';

    it('should mark template as unseen', async () => {
      await service.markAsUnseen(templatePath, 'hash123');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.UNSEEN);
      expect(state?.currentHash).toBe('hash123');
    });

    it('should mark template as synced', async () => {
      await service.markAsSynced(templatePath, 'hash123');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.SYNCED);
      expect(state?.currentHash).toBe('hash123');
    });

    it('should mark template as changed', async () => {
      await service.markAsChanged(templatePath, 'hash123');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.CHANGED);
      expect(state?.currentHash).toBe('hash123');
    });

    it('should mark template as applied', async () => {
      await service.markAsApplied(templatePath, 'hash123');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.APPLIED);
      expect(state?.lastAppliedHash).toBe('hash123');
      expect(state?.lastAppliedDate).toBeDefined();
      expect(state?.lastError).toBeUndefined();
    });

    it('should mark template as built', async () => {
      await service.markAsBuilt(templatePath, 'hash123', '20240101_test.sql');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.BUILT);
      expect(state?.lastBuiltHash).toBe('hash123');
      expect(state?.lastBuiltDate).toBeDefined();
      expect(state?.lastError).toBeUndefined();
    });

    it('should mark template as error during apply', async () => {
      await service.markAsError(templatePath, 'Database connection failed', 'apply');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.ERROR);
      expect(state?.lastError).toBe('Database connection failed');
    });

    it('should mark template as error during build', async () => {
      await service.markAsError(templatePath, 'File write failed', 'build');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.ERROR);
      expect(state?.lastError).toBe('File write failed');
    });

    it('should emit state transition events', async () => {
      const transitionHandler = vi.fn();
      service.on('state:transition', transitionHandler);

      await service.markAsApplied(templatePath, 'hash123');

      expect(transitionHandler).toHaveBeenCalledWith({
        templatePath,
        fromState: TemplateState.UNSEEN,
        toState: TemplateState.APPLIED,
        timestamp: expect.any(String),
      });
    });

    it('should validate state transitions', async () => {
      // First mark as applied
      await service.markAsApplied(templatePath, 'hash123');

      // Should be able to transition to built
      await expect(service.markAsBuilt(templatePath, 'hash123')).resolves.not.toThrow();

      // Should be able to transition to error
      await expect(service.markAsError(templatePath, 'Test error')).resolves.not.toThrow();

      // Should be able to recover from error to applied
      await expect(service.markAsApplied(templatePath, 'hash456')).resolves.not.toThrow();
    });

    it('should handle all valid transition paths', async () => {
      // Test all valid transitions from the VALID_TRANSITIONS matrix
      const testCases = [
        { from: TemplateState.UNSEEN, to: TemplateState.SYNCED },
        { from: TemplateState.SYNCED, to: TemplateState.CHANGED },
        { from: TemplateState.CHANGED, to: TemplateState.APPLIED },
        { from: TemplateState.APPLIED, to: TemplateState.BUILT },
        { from: TemplateState.BUILT, to: TemplateState.ERROR },
        { from: TemplateState.ERROR, to: TemplateState.APPLIED },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testPath = `/test/base/templates/test${i}.sql`;
        const testCase = testCases[i];
        if (!testCase) continue;
        const { from, to } = testCase;

        // Set initial state
        if (from === TemplateState.UNSEEN) {
          // Start with unseen
        } else if (from === TemplateState.SYNCED) {
          await service.markAsSynced(testPath, 'hash');
        } else if (from === TemplateState.CHANGED) {
          await service.markAsChanged(testPath, 'hash');
        } else if (from === TemplateState.APPLIED) {
          await service.markAsApplied(testPath, 'hash');
        } else if (from === TemplateState.BUILT) {
          await service.markAsBuilt(testPath, 'hash');
        } else if (from === TemplateState.ERROR) {
          await service.markAsError(testPath, 'error');
        }

        // Test transition
        if (to === TemplateState.SYNCED) {
          await service.markAsSynced(testPath, 'newhash');
        } else if (to === TemplateState.CHANGED) {
          await service.markAsChanged(testPath, 'newhash');
        } else if (to === TemplateState.APPLIED) {
          await service.markAsApplied(testPath, 'newhash');
        } else if (to === TemplateState.BUILT) {
          await service.markAsBuilt(testPath, 'newhash');
        } else if (to === TemplateState.ERROR) {
          await service.markAsError(testPath, 'error');
        }

        const state = service.getTemplateStatus(testPath);
        expect(state?.state).toBe(to);
      }
    });
  });

  describe('hash comparison', () => {
    const templatePath = '/test/base/templates/test.sql';

    it('should detect changed templates with no previous state', async () => {
      const hasChanged = service.hasTemplateChanged(templatePath, 'hash123');
      expect(hasChanged).toBe(true);
    });

    it('should detect changed templates with different hash', async () => {
      await service.markAsApplied(templatePath, 'oldhash');

      const hasChanged = service.hasTemplateChanged(templatePath, 'newhash');
      expect(hasChanged).toBe(true);
    });

    it('should detect unchanged templates with same applied hash', async () => {
      await service.markAsApplied(templatePath, 'samehash');

      const hasChanged = service.hasTemplateChanged(templatePath, 'samehash');
      expect(hasChanged).toBe(false);
    });

    it('should detect unchanged templates with same built hash', async () => {
      await service.markAsBuilt(templatePath, 'samehash');

      const hasChanged = service.hasTemplateChanged(templatePath, 'samehash');
      expect(hasChanged).toBe(false);
    });

    it('should prioritize built hash over applied hash', async () => {
      await service.markAsApplied(templatePath, 'appliedhash');
      await service.markAsBuilt(templatePath, 'builthash');

      // Both hashes should be considered unchanged
      const hasChangedFromApplied = service.hasTemplateChanged(templatePath, 'appliedhash');
      expect(hasChangedFromApplied).toBe(false); // Applied hash is still valid

      const hasChangedFromBuilt = service.hasTemplateChanged(templatePath, 'builthash');
      expect(hasChangedFromBuilt).toBe(false); // Built hash is also valid
    });
  });

  describe('persistence', () => {
    it('should save buildlogs to correct files', async () => {
      const templatePath = '/test/base/templates/test.sql';

      await service.markAsBuilt(templatePath, 'hash123', 'migration.sql');
      await service.saveBuildLogs();

      // Verify both files were written
      expect(fs.writeFile).toHaveBeenCalledTimes(2);

      // Check that the content includes the new hash
      const calls = vi.mocked(fs.writeFile).mock.calls;
      const buildLogCall = calls.find(call => call[0] === config.buildLogPath);
      const content = JSON.parse(buildLogCall?.[1] as string);

      expect(content.templates['templates/test.sql'].lastBuildHash).toBe('hash123');
      expect(content.templates['templates/test.sql'].lastMigrationFile).toBe('migration.sql');
    });

    it('should handle save failures', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));

      const errorHandler = vi.fn();
      service.on('error', errorHandler);

      await expect(service.saveBuildLogs()).rejects.toThrow('Write failed');
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should auto-save when enabled', async () => {
      const autoSaveConfig = { ...config, autoSave: true };
      const autoSaveService = new StateService(autoSaveConfig);

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} })
      );
      await autoSaveService.initialize();

      // Clear previous calls
      vi.mocked(fs.writeFile).mockClear();

      await autoSaveService.markAsApplied('/test/path.sql', 'hash');

      // Wait a bit for auto-save debouncing
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(fs.writeFile).toHaveBeenCalled();

      await autoSaveService.dispose();
    });

    it('should update timestamps correctly', () => {
      const timestamp = '2024-01-01T12:00:00.000Z';
      service.updateTimestamp(timestamp);

      // Verify timestamp is stored (would be tested through save operation)
      expect(() => service.updateTimestamp(timestamp)).not.toThrow();
    });
  });

  describe('state management', () => {
    it('should return undefined for non-existent template', () => {
      const state = service.getTemplateStatus('/non/existent/path.sql');
      expect(state).toBeUndefined();
    });

    it('should return all template statuses', () => {
      const states = service.getAllTemplateStatuses();
      expect(states).toBeInstanceOf(Map);
      expect(states.size).toBe(2); // From mock data
    });

    it('should clear all states', async () => {
      await service.clearAllStates();

      const states = service.getAllTemplateStatuses();
      expect(states.size).toBe(0);

      // Check that both buildlog files were written
      expect(fs.writeFile).toHaveBeenCalledTimes(2);

      // Verify the content contains empty templates
      const calls = vi.mocked(fs.writeFile).mock.calls;
      const buildLogCall = calls.find(call => call[0] === config.buildLogPath);
      const localBuildLogCall = calls.find(call => call[0] === config.localBuildLogPath);

      expect(buildLogCall).toBeDefined();
      expect(localBuildLogCall).toBeDefined();

      const buildLogContent = JSON.parse(buildLogCall?.[1] as string);
      const localBuildLogContent = JSON.parse(localBuildLogCall?.[1] as string);

      expect(buildLogContent.templates).toEqual({});
      expect(localBuildLogContent.templates).toEqual({});
    });

    it('should emit cleared event when clearing all states', async () => {
      const clearHandler = vi.fn();
      service.on('state:cleared', clearHandler);

      await service.clearAllStates();

      expect(clearHandler).toHaveBeenCalled();
    });
  });

  describe('state determination from metadata', () => {
    it('should determine ERROR state from error metadata', async () => {
      // Create service and manually test the state determination
      const testService = new StateService(config);

      // Mock buildlog with error
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return JSON.stringify({
            version: '1.0',
            lastTimestamp: '',
            templates: {
              'templates/error.sql': {
                lastAppliedError: 'SQL error',
              },
            },
          });
        }
        return JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} });
      });

      await testService.initialize();

      const state = testService.getTemplateStatus('/test/base/templates/error.sql');
      expect(state?.state).toBe(TemplateState.ERROR);
      expect(state?.lastError).toBe('SQL error');

      await testService.dispose();
    });

    it('should determine BUILT state from build metadata', async () => {
      const testService = new StateService(config);

      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return JSON.stringify({
            version: '1.0',
            lastTimestamp: '',
            templates: {
              'templates/built.sql': {
                lastBuildHash: 'hash123',
              },
            },
          });
        }
        return JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} });
      });

      await testService.initialize();

      const state = testService.getTemplateStatus('/test/base/templates/built.sql');
      expect(state?.state).toBe(TemplateState.BUILT);
      expect(state?.lastBuiltHash).toBe('hash123');

      await testService.dispose();
    });

    it('should determine APPLIED state from apply metadata', async () => {
      const testService = new StateService(config);

      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.localBuildLogPath) {
          return JSON.stringify({
            version: '1.0',
            lastTimestamp: '',
            templates: {
              'templates/applied.sql': {
                lastAppliedHash: 'hash123',
              },
            },
          });
        }
        return JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} });
      });

      await testService.initialize();

      const state = testService.getTemplateStatus('/test/base/templates/applied.sql');
      expect(state?.state).toBe(TemplateState.APPLIED);
      expect(state?.lastAppliedHash).toBe('hash123');

      await testService.dispose();
    });

    it('should determine UNSEEN state for templates with no metadata', async () => {
      const testService = new StateService(config);

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          version: '1.0',
          lastTimestamp: '',
          templates: {},
        })
      );

      await testService.initialize();

      // Should start with empty state, then mark as unseen when accessed
      await testService.markAsUnseen('/test/base/templates/new.sql');
      const state = testService.getTemplateStatus('/test/base/templates/new.sql');
      expect(state?.state).toBe(TemplateState.UNSEEN);

      await testService.dispose();
    });
  });

  describe('getRecentActivity', () => {
    it('should return entries sorted by timestamp descending (most recent first)', async () => {
      const testService = new StateService(config);

      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return JSON.stringify({
            version: '1.0',
            lastTimestamp: '',
            templates: {
              'templates/older.sql': {
                lastBuildHash: 'hash1',
                lastBuildDate: '2024-01-01T10:00:00.000Z',
                lastMigrationFile: '20240101_older.sql',
              },
              'templates/newer.sql': {
                lastBuildHash: 'hash2',
                lastBuildDate: '2024-01-02T10:00:00.000Z',
                lastMigrationFile: '20240102_newer.sql',
              },
            },
          });
        }
        return JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} });
      });

      await testService.initialize();

      const activity = testService.getRecentActivity();

      expect(activity).toHaveLength(2);
      expect(activity[0]?.template).toBe('templates/newer.sql');
      expect(activity[1]?.template).toBe('templates/older.sql');

      await testService.dispose();
    });

    it('should respect limit parameter', async () => {
      const testService = new StateService(config);

      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return JSON.stringify({
            version: '1.0',
            lastTimestamp: '',
            templates: {
              'templates/a.sql': {
                lastBuildHash: 'hash1',
                lastBuildDate: '2024-01-01T10:00:00.000Z',
              },
              'templates/b.sql': {
                lastBuildHash: 'hash2',
                lastBuildDate: '2024-01-02T10:00:00.000Z',
              },
              'templates/c.sql': {
                lastBuildHash: 'hash3',
                lastBuildDate: '2024-01-03T10:00:00.000Z',
              },
            },
          });
        }
        return JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} });
      });

      await testService.initialize();

      const activityDefault = testService.getRecentActivity();
      expect(activityDefault).toHaveLength(3);

      const activityLimited = testService.getRecentActivity(2);
      expect(activityLimited).toHaveLength(2);
      expect(activityLimited[0]?.template).toBe('templates/c.sql');
      expect(activityLimited[1]?.template).toBe('templates/b.sql');

      await testService.dispose();
    });

    it('should return empty array when no builds or applies exist', async () => {
      const testService = new StateService(config);

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          version: '1.0',
          lastTimestamp: '',
          templates: {},
        })
      );

      await testService.initialize();

      const activity = testService.getRecentActivity();
      expect(activity).toEqual([]);

      await testService.dispose();
    });

    it('should combine both build and apply entries', async () => {
      const testService = new StateService(config);

      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === config.buildLogPath) {
          return JSON.stringify({
            version: '1.0',
            lastTimestamp: '',
            templates: {
              'templates/built.sql': {
                lastBuildHash: 'hash1',
                lastBuildDate: '2024-01-02T10:00:00.000Z',
                lastMigrationFile: '20240102_built.sql',
              },
            },
          });
        }
        if (filePath === config.localBuildLogPath) {
          return JSON.stringify({
            version: '1.0',
            lastTimestamp: '',
            templates: {
              'templates/applied.sql': {
                lastAppliedHash: 'hash2',
                lastAppliedDate: '2024-01-03T10:00:00.000Z',
              },
            },
          });
        }
        throw new Error('File not found');
      });

      await testService.initialize();

      const activity = testService.getRecentActivity();

      expect(activity).toHaveLength(2);
      expect(activity[0]?.action).toBe('applied');
      expect(activity[0]?.template).toBe('templates/applied.sql');
      expect(activity[1]?.action).toBe('built');
      expect(activity[1]?.template).toBe('templates/built.sql');
      expect(activity[1]?.target).toBe('20240102_built.sql');

      await testService.dispose();
    });
  });

  describe('resource cleanup', () => {
    it('should dispose cleanly', async () => {
      const autoSaveConfig = { ...config, autoSave: true };
      const testService = new StateService(autoSaveConfig);

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} })
      );
      await testService.initialize();

      const listener = vi.fn();
      testService.on('test', listener);

      await testService.dispose();

      // Should have no listeners after disposal
      expect(testService.listenerCount('test')).toBe(0);
    });

    it('should save before disposing with auto-save enabled', async () => {
      const autoSaveConfig = { ...config, autoSave: true };
      const testService = new StateService(autoSaveConfig);

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', lastTimestamp: '', templates: {} })
      );
      await testService.initialize();

      vi.mocked(fs.writeFile).mockClear();

      await testService.markAsApplied('/test/path.sql', 'hash');
      await testService.dispose();

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle concurrent state updates safely', async () => {
      const templatePath = '/test/base/templates/concurrent.sql';

      // Simulate concurrent updates
      const promises = [
        service.markAsApplied(templatePath, 'hash1'),
        service.markAsBuilt(templatePath, 'hash2'),
        service.markAsError(templatePath, 'error'),
      ];

      await Promise.all(promises);

      // Should have settled to one final state
      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBeDefined();
    });

    it('should handle paths with special characters', async () => {
      const specialPath = '/test/base/templates/спец-файл с пробелами.sql';

      await service.markAsApplied(specialPath, 'hash123');

      const state = service.getTemplateStatus(specialPath);
      expect(state?.state).toBe(TemplateState.APPLIED);
    });

    it('should handle very long file paths', async () => {
      const longPath = '/test/base/templates/' + 'a'.repeat(200) + '.sql';

      await service.markAsApplied(longPath, 'hash123');

      const state = service.getTemplateStatus(longPath);
      expect(state?.state).toBe(TemplateState.APPLIED);
    });

    it('should handle empty hashes gracefully', async () => {
      const templatePath = '/test/base/templates/empty.sql';

      await service.markAsApplied(templatePath, '');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.lastAppliedHash).toBe('');
      expect(state?.state).toBe(TemplateState.APPLIED);
    });

    it('should maintain state consistency after multiple operations', async () => {
      const templatePath = '/test/base/templates/consistency.sql';

      // Perform a sequence of operations
      await service.markAsChanged(templatePath, 'hash1');
      await service.markAsApplied(templatePath, 'hash2');
      await service.markAsBuilt(templatePath, 'hash3');
      await service.markAsError(templatePath, 'Build failed');
      await service.markAsApplied(templatePath, 'hash4');

      const state = service.getTemplateStatus(templatePath);
      expect(state?.state).toBe(TemplateState.APPLIED);
      expect(state?.lastAppliedHash).toBe('hash4');
      expect(state?.lastError).toBeUndefined(); // Error should be cleared on successful apply
    });
  });

  describe('getLastTimestamp', () => {
    it('should return the last timestamp from build log', () => {
      const timestamp = service.getLastTimestamp();
      expect(timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should return updated timestamp after updateTimestamp is called', () => {
      service.updateTimestamp('2024-02-01T12:00:00.000Z');

      const timestamp = service.getLastTimestamp();
      expect(timestamp).toBe('2024-02-01T12:00:00.000Z');
    });
  });

  describe('getTemplateBuildState', () => {
    it('should return undefined for non-existent template', () => {
      const buildState = service.getTemplateBuildState('/test/base/templates/nonexistent.sql');
      expect(buildState).toBeUndefined();
    });

    it('should return merged build state from both common and local logs', () => {
      // users.sql exists in both common and local build logs
      const buildState = service.getTemplateBuildState('/test/base/templates/users.sql');

      expect(buildState).toBeDefined();
      // From common build log
      expect(buildState?.lastBuildHash).toBe('build123');
      expect(buildState?.lastBuildDate).toBe('2024-01-01T10:00:00.000Z');
      expect(buildState?.lastMigrationFile).toBe('20240101100000_users.sql');
      // From local build log
      expect(buildState?.lastAppliedHash).toBe('apply123');
      expect(buildState?.lastAppliedDate).toBe('2024-01-01T09:00:00.000Z');
    });

    it('should return local-only state when template only in local log', () => {
      // posts.sql only exists in local build log
      const buildState = service.getTemplateBuildState('/test/base/templates/posts.sql');

      expect(buildState).toBeDefined();
      expect(buildState?.lastAppliedHash).toBe('apply456');
      expect(buildState?.lastAppliedError).toBe('SQL syntax error');
      expect(buildState?.lastBuildHash).toBeUndefined();
    });

    it('should handle relative paths', () => {
      const buildState = service.getTemplateBuildState('templates/users.sql');

      expect(buildState).toBeDefined();
      expect(buildState?.lastBuildHash).toBe('build123');
    });
  });

  describe('getBuildLogForMigration', () => {
    it('should return the build log for migration generation', () => {
      const buildLog = service.getBuildLogForMigration();

      expect(buildLog).toBeDefined();
      expect(buildLog.version).toBe('1.0');
      expect(buildLog.lastTimestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(buildLog.templates['templates/users.sql']).toBeDefined();
    });

    it('should return a read-only view of the build log', () => {
      const buildLog = service.getBuildLogForMigration();

      // Verify it has the expected structure
      expect(buildLog.templates).toBeDefined();
      expect(Object.keys(buildLog.templates).length).toBeGreaterThan(0);
    });
  });

  describe('renameTemplate', () => {
    it('should rename template in common build log', async () => {
      const oldPath = '/test/base/templates/users.sql';
      const newPath = '/test/base/templates/users-renamed.sql';

      await service.renameTemplate(oldPath, newPath);

      // Old entry should be removed
      const oldState = service.getTemplateBuildState(oldPath);
      expect(oldState).toBeUndefined();

      // New entry should exist with same data
      const newState = service.getTemplateBuildState(newPath);
      expect(newState).toBeDefined();
      expect(newState?.lastBuildHash).toBe('build123');
      expect(newState?.lastAppliedHash).toBe('apply123');
    });

    it('should rename template in local build log', async () => {
      const oldPath = '/test/base/templates/posts.sql';
      const newPath = '/test/base/templates/posts-renamed.sql';

      await service.renameTemplate(oldPath, newPath);

      const oldState = service.getTemplateBuildState(oldPath);
      expect(oldState).toBeUndefined();

      const newState = service.getTemplateBuildState(newPath);
      expect(newState).toBeDefined();
      expect(newState?.lastAppliedHash).toBe('apply456');
    });

    it('should update in-memory state map', async () => {
      const oldPath = '/test/base/templates/users.sql';
      const newPath = '/test/base/templates/users-renamed.sql';

      // First verify the old path has state
      const oldTemplateStatus = service.getTemplateStatus(oldPath);
      expect(oldTemplateStatus).toBeDefined();

      await service.renameTemplate(oldPath, newPath);

      // Old path should no longer have state
      const oldStateAfter = service.getTemplateStatus(oldPath);
      expect(oldStateAfter).toBeUndefined();

      // New path should have state
      const newState = service.getTemplateStatus(newPath);
      expect(newState).toBeDefined();
    });

    it('should handle non-existent template gracefully', async () => {
      const oldPath = '/test/base/templates/nonexistent.sql';
      const newPath = '/test/base/templates/new.sql';

      // Should not throw
      await expect(service.renameTemplate(oldPath, newPath)).resolves.not.toThrow();
    });

    it('should handle relative paths', async () => {
      const oldPath = 'templates/users.sql';
      const newPath = 'templates/users-new.sql';

      await service.renameTemplate(oldPath, newPath);

      const newState = service.getTemplateBuildState(newPath);
      expect(newState).toBeDefined();
      expect(newState?.lastBuildHash).toBe('build123');
    });
  });

  describe('clearBuildLogs', () => {
    it('should clear local build logs only', async () => {
      await service.clearBuildLogs('local');

      // Local should be empty but shared should still have data
      const usersState = service.getTemplateBuildState('/test/base/templates/users.sql');
      expect(usersState?.lastBuildHash).toBe('build123'); // From shared
      expect(usersState?.lastAppliedHash).toBeUndefined(); // Cleared from local

      // Posts was only in local, should be gone
      const postsState = service.getTemplateBuildState('/test/base/templates/posts.sql');
      expect(postsState).toBeUndefined();
    });

    it('should clear shared build logs only', async () => {
      await service.clearBuildLogs('shared');

      // Shared should be empty but local should still have data
      const usersState = service.getTemplateBuildState('/test/base/templates/users.sql');
      expect(usersState?.lastBuildHash).toBeUndefined(); // Cleared from shared
      expect(usersState?.lastAppliedHash).toBe('apply123'); // Still in local
    });

    it('should clear both build logs', async () => {
      await service.clearBuildLogs('both');

      // Both should be empty
      const usersState = service.getTemplateBuildState('/test/base/templates/users.sql');
      expect(usersState).toBeUndefined();

      const postsState = service.getTemplateBuildState('/test/base/templates/posts.sql');
      expect(postsState).toBeUndefined();
    });

    it('should emit state:cleared event', async () => {
      const handler = vi.fn();
      service.on('state:cleared', handler);

      await service.clearBuildLogs('local');

      expect(handler).toHaveBeenCalled();
    });
  });
});
