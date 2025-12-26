/**
 * FileSystemService tests
 * Tests all file system operations with mocked dependencies
 */

import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import { glob } from 'glob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemService } from '../FileSystemService.js';
import type { FileSystemConfig, WatchEvent } from '../FileSystemService.js';

// Mock modules
vi.mock('node:fs/promises');
vi.mock('glob');
vi.mock('chokidar');

describe('FileSystemService', () => {
  let service: FileSystemService;
  let config: FileSystemConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      baseDir: '/test/base',
      templateDir: 'templates',
      filter: '*.sql',
      migrationDir: 'migrations',
    };

    service = new FileSystemService(config);
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('findTemplates', () => {
    it('should find all template files matching the pattern', async () => {
      const mockFiles = [
        '/test/base/templates/users.sql',
        '/test/base/templates/posts.sql',
        '/test/base/templates/comments.sql',
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);

      const result = await service.findTemplates();

      expect(glob).toHaveBeenCalledWith('/test/base/templates/*.sql');
      expect(result).toEqual(mockFiles);
      expect(result).toHaveLength(3);
    });

    it('should return sorted results', async () => {
      const mockFiles = [
        '/test/base/templates/zebra.sql',
        '/test/base/templates/apple.sql',
        '/test/base/templates/banana.sql',
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);

      const result = await service.findTemplates();

      expect(result).toEqual([
        '/test/base/templates/apple.sql',
        '/test/base/templates/banana.sql',
        '/test/base/templates/zebra.sql',
      ]);
    });

    it('should handle empty results', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const result = await service.findTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('readTemplate', () => {
    it('should read template file and return content with metadata', async () => {
      const templatePath = '/test/base/templates/users.sql';
      const content = 'CREATE TABLE users (id INT PRIMARY KEY);';

      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await service.readTemplate(templatePath);

      expect(fs.readFile).toHaveBeenCalledWith(templatePath, 'utf-8');
      expect(result).toMatchObject({
        path: templatePath,
        name: 'users',
        content,
        relativePath: 'templates/users.sql',
      });
      expect(result.hash).toBeDefined();
      expect(result.hash).toHaveLength(32); // MD5 hash length
    });

    it('should calculate correct MD5 hash', async () => {
      const templatePath = '/test/base/templates/test.sql';
      const content = 'SELECT 1;';
      // MD5 hash of 'SELECT 1;' is '71568061b2970a4b7c5160fe75356e10'

      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await service.readTemplate(templatePath);

      expect(result.hash).toBe('71568061b2970a4b7c5160fe75356e10');
    });

    it('should throw error for non-existent file', async () => {
      const templatePath = '/test/base/templates/missing.sql';
      const error = new Error('ENOENT');
      (error as any).code = 'ENOENT';

      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(service.readTemplate(templatePath)).rejects.toThrow(
        'Template file not found: /test/base/templates/missing.sql'
      );
    });

    it('should propagate other errors', async () => {
      const templatePath = '/test/base/templates/error.sql';
      const error = new Error('Permission denied');

      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(service.readTemplate(templatePath)).rejects.toThrow('Permission denied');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      vi.mocked(fs.stat).mockResolvedValue({} as Stats);

      const result = await service.fileExists('/test/file.sql');

      expect(result).toBe(true);
      expect(fs.stat).toHaveBeenCalledWith('/test/file.sql');
    });

    it('should return false for non-existent file', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      const result = await service.fileExists('/test/missing.sql');

      expect(result).toBe(false);
    });
  });

  describe('writeFile', () => {
    it('should create directory and write file', async () => {
      const filePath = '/test/base/migrations/001_users.sql';
      const content = 'CREATE TABLE users;';

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await service.writeFile(filePath, content);

      expect(fs.mkdir).toHaveBeenCalledWith('/test/base/migrations', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf-8');
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      vi.mocked(fs.unlink).mockResolvedValue();

      await service.deleteFile('/test/file.sql');

      expect(fs.unlink).toHaveBeenCalledWith('/test/file.sql');
    });

    it('should ignore ENOENT errors', async () => {
      const error = new Error('ENOENT');
      (error as any).code = 'ENOENT';

      vi.mocked(fs.unlink).mockRejectedValue(error);

      await expect(service.deleteFile('/test/missing.sql')).resolves.toBeUndefined();
    });

    it('should propagate other errors', async () => {
      const error = new Error('Permission denied');

      vi.mocked(fs.unlink).mockRejectedValue(error);

      await expect(service.deleteFile('/test/file.sql')).rejects.toThrow('Permission denied');
    });
  });

  describe('getFileStats', () => {
    it('should return file stats', async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date('2024-01-01'),
      } as Stats;

      vi.mocked(fs.stat).mockResolvedValue(mockStats);

      const result = await service.getFileStats('/test/file.sql');

      expect(result).toBe(mockStats);
      expect(fs.stat).toHaveBeenCalledWith('/test/file.sql');
    });
  });

  describe('watchTemplates', () => {
    let mockWatcher: any;

    beforeEach(() => {
      mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };

      vi.doMock('chokidar', () => ({
        watch: vi.fn().mockReturnValue(mockWatcher),
      }));
    });

    it('should start watching templates directory', async () => {
      const chokidar = await import('chokidar');
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher);
      vi.mocked(glob).mockResolvedValue([]);

      await service.watchTemplates();

      expect(chokidar.watch).toHaveBeenCalledWith(
        '/test/base/templates',
        expect.objectContaining({
          ignoreInitial: false,
          ignored: ['**/!(*.sql)'],
          persistent: true,
          awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 100,
          },
        })
      );
    });

    it('should emit events for initial files', async () => {
      const chokidar = await import('chokidar');
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher);

      const mockFiles = ['/test/base/templates/users.sql', '/test/base/templates/posts.sql'];
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const events: WatchEvent[] = [];
      service.on('template:added', event => events.push(event));

      await service.watchTemplates();

      // Wait for debouncing
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(events).toHaveLength(2);
      // Events might not be in order due to async processing
      const userEvent = events.find(e => e.name === 'users');
      const postsEvent = events.find(e => e.name === 'posts');

      expect(userEvent).toMatchObject({
        type: 'added',
        path: '/test/base/templates/users.sql',
        name: 'users',
      });

      expect(postsEvent).toMatchObject({
        type: 'added',
        path: '/test/base/templates/posts.sql',
        name: 'posts',
      });
    });

    it('should throw error if already watching', async () => {
      const chokidar = await import('chokidar');
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher);
      vi.mocked(glob).mockResolvedValue([]);

      await service.watchTemplates();

      await expect(service.watchTemplates()).rejects.toThrow('Already watching templates');
    });

    it('should handle watch errors', async () => {
      const chokidar = await import('chokidar');
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher);
      vi.mocked(glob).mockResolvedValue([]);

      const errorHandler = vi.fn();
      service.on('error', errorHandler);

      await service.watchTemplates();

      // Simulate error event
      const errorCallback = mockWatcher.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];

      const testError = new Error('Watch error');
      errorCallback?.(testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
    });
  });

  describe('stopWatching', () => {
    it('should stop watching and clear timers', async () => {
      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const chokidar = await import('chokidar');
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any);
      vi.mocked(glob).mockResolvedValue([]);

      await service.watchTemplates();
      await service.stopWatching();

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should be safe to call without watching', async () => {
      await expect(service.stopWatching()).resolves.toBeUndefined();
    });
  });

  describe('getMigrationPath', () => {
    it('should generate correct migration path', () => {
      const result = service.getMigrationPath('users', '20240101120000');

      expect(result).toBe('/test/base/migrations/20240101120000_users.sql');
    });
  });

  describe('listMigrations', () => {
    it('should list all migration files sorted', async () => {
      const mockMigrations = [
        '/test/base/migrations/20240103_third.sql',
        '/test/base/migrations/20240101_first.sql',
        '/test/base/migrations/20240102_second.sql',
      ];

      vi.mocked(glob).mockResolvedValue(mockMigrations);

      const result = await service.listMigrations();

      expect(glob).toHaveBeenCalledWith('/test/base/migrations/*.sql');
      expect(result).toEqual([
        '/test/base/migrations/20240101_first.sql',
        '/test/base/migrations/20240102_second.sql',
        '/test/base/migrations/20240103_third.sql',
      ]);
    });
  });

  describe('readMigration', () => {
    it('should read migration file content', async () => {
      const migrationPath = '/test/base/migrations/001_users.sql';
      const content = 'CREATE TABLE users;';

      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await service.readMigration(migrationPath);

      expect(fs.readFile).toHaveBeenCalledWith(migrationPath, 'utf-8');
      expect(result).toBe(content);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', async () => {
      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const chokidar = await import('chokidar');
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any);
      vi.mocked(glob).mockResolvedValue([]);

      const listener = vi.fn();
      service.on('test', listener);

      await service.watchTemplates();
      await service.dispose();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(service.listenerCount('test')).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit specific event types', async () => {
      const events: string[] = [];

      service.on('template:added', () => events.push('added'));
      service.on('template:changed', () => events.push('changed'));
      service.on('template:removed', () => events.push('removed'));
      service.on('template:event', () => events.push('generic'));

      // Trigger private method through reflection for testing
      (service as any).emitWatchEvent('added', '/test/file.sql');
      (service as any).emitWatchEvent('changed', '/test/file.sql');
      (service as any).emitWatchEvent('removed', '/test/file.sql');

      // Wait a tick for events to propagate
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(events).toEqual(['added', 'generic', 'changed', 'generic', 'removed', 'generic']);
    });
  });
});
