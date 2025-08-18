/**
 * MigrationBuilder tests
 * Comprehensive unit tests covering migration content generation, file writing,
 * configuration handling, and error scenarios
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildLog } from '../../types.js';
import {
  MigrationBuilder,
  type MigrationBuilderConfig,
  type TemplateMetadata,
} from '../MigrationBuilder.js';

// Mock fs module
vi.mock('node:fs/promises');

// Mock getNextTimestamp utility
vi.mock('../../utils/getNextTimestamp.js', () => ({
  getNextTimestamp: vi.fn(),
}));

import { getNextTimestamp } from '../../utils/getNextTimestamp.js';

describe('MigrationBuilder', () => {
  let builder: MigrationBuilder;
  let config: MigrationBuilderConfig;
  let mockBuildLog: BuildLog;
  let templateMetadata: TemplateMetadata;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      baseDir: '/test/project',
      templateDir: 'templates',
      migrationDir: 'migrations',
      migrationPrefix: 'test',
      banner: 'Auto-generated migration',
      footer: 'Migration footer',
      wrapInTransaction: true,
    };

    mockBuildLog = {
      version: '1.0',
      lastTimestamp: '20240101000000',
      templates: {},
    };

    templateMetadata = {
      name: 'create_users',
      templatePath: '/test/project/templates/create_users.sql',
      relativePath: 'templates/create_users.sql',
      content: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);',
      hash: 'abc123',
      lastBuildAt: '20240101000000_test-create_users.sql',
    };

    builder = new MigrationBuilder(config);

    // Mock filesystem operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

    // Mock timestamp generation
    vi.mocked(getNextTimestamp).mockResolvedValue('20240101123456');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization and configuration', () => {
    it('should create builder with required configuration', () => {
      const minimalConfig = {
        baseDir: '/test',
        templateDir: 'templates',
        migrationDir: 'migrations',
      };

      const minimalBuilder = new MigrationBuilder(minimalConfig);
      expect(minimalBuilder).toBeInstanceOf(MigrationBuilder);
    });

    it('should merge configuration with defaults', () => {
      const minimalConfig = {
        baseDir: '/test',
        templateDir: 'templates',
        migrationDir: 'migrations',
      };

      const minimalBuilder = new MigrationBuilder(minimalConfig);
      const finalConfig = minimalBuilder.getConfig();

      expect(finalConfig.migrationPrefix).toBe('');
      expect(finalConfig.banner).toBe('');
      expect(finalConfig.footer).toBe('');
      expect(finalConfig.wrapInTransaction).toBe(true);
    });

    it('should create builder from CLI config', () => {
      const cliConfig = {
        pgConnection: 'postgresql://test:test@localhost:5432/test',
        wrapInTransaction: true,
        filter: '**/*.sql',
        wipIndicator: '.wip',
        banner: 'Test banner',
        footer: 'Test footer',
        templateDir: 'templates',
        migrationDir: 'migrations',
        migrationPrefix: 'srtd',
        buildLog: '.buildlog.json',
        localBuildLog: '.buildlog.local.json',
      };

      const fromConfigBuilder = MigrationBuilder.fromConfig(cliConfig, '/test/project');
      expect(fromConfigBuilder).toBeInstanceOf(MigrationBuilder);

      const finalConfig = fromConfigBuilder.getConfig();
      expect(finalConfig.banner).toBe('Test banner');
      expect(finalConfig.migrationPrefix).toBe('srtd');
    });

    it('should validate configuration', () => {
      const validResult = builder.validateConfig();
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidBuilder = new MigrationBuilder({
        baseDir: '',
        templateDir: '',
        migrationDir: '',
      });

      const invalidResult = invalidBuilder.validateConfig();
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('baseDir is required');
      expect(invalidResult.errors).toContain('templateDir is required');
      expect(invalidResult.errors).toContain('migrationDir is required');
    });
  });

  describe('migration content generation', () => {
    it('should generate migration with all components', async () => {
      const result = await builder.generateMigration(templateMetadata, mockBuildLog);

      expect(result.fileName).toBe('20240101123456_test-create_users.sql');
      expect(result.filePath).toBe('migrations/20240101123456_test-create_users.sql');
      expect(result.timestamp).toBe('20240101123456');

      const content = result.content;
      expect(content).toContain('-- Generated with srtd from template: templates/create_users.sql');
      expect(content).toContain('-- Auto-generated migration');
      expect(content).toContain('BEGIN;');
      expect(content).toContain('CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);');
      expect(content).toContain('COMMIT;');
      expect(content).toContain('Migration footer');
      expect(content).toContain('-- Last built: 20240101000000_test-create_users.sql');
      expect(content).toContain('-- Built with https://github.com/t1mmen/srtd');
    });

    it('should generate migration without transaction wrapping', async () => {
      const result = await builder.generateMigration(templateMetadata, mockBuildLog, {
        wrapInTransaction: false,
      });

      const content = result.content;
      expect(content).not.toContain('BEGIN;');
      expect(content).not.toContain('COMMIT;');
      expect(content).toContain('CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);');
    });

    it('should generate migration without prefix', async () => {
      const noPrefixBuilder = new MigrationBuilder({
        ...config,
        migrationPrefix: undefined,
      });

      const result = await noPrefixBuilder.generateMigration(templateMetadata, mockBuildLog);

      expect(result.fileName).toBe('20240101123456_create_users.sql');
      expect(result.filePath).toBe('migrations/20240101123456_create_users.sql');
    });

    it('should generate migration without banner and footer', async () => {
      const minimalBuilder = new MigrationBuilder({
        ...config,
        banner: '',
        footer: '',
      });

      const result = await minimalBuilder.generateMigration(templateMetadata, mockBuildLog);

      const content = result.content;
      expect(content).not.toContain('-- Auto-generated migration');
      expect(content).not.toContain('Migration footer');
      expect(content).toContain('-- Generated with srtd from template');
      expect(content).toContain('-- Built with https://github.com/t1mmen/srtd');
    });

    it('should handle template without lastBuildAt', async () => {
      const templateWithoutBuild = {
        ...templateMetadata,
        lastBuildAt: undefined,
      };

      const result = await builder.generateMigration(templateWithoutBuild, mockBuildLog);

      const content = result.content;
      expect(content).toContain('-- Last built: Never');
    });

    it('should generate unique timestamps', async () => {
      vi.mocked(getNextTimestamp)
        .mockResolvedValueOnce('20240101123456')
        .mockResolvedValueOnce('20240101123457');

      const result1 = await builder.generateMigration(templateMetadata, mockBuildLog);
      const result2 = await builder.generateMigration(templateMetadata, mockBuildLog);

      expect(result1.timestamp).toBe('20240101123456');
      expect(result2.timestamp).toBe('20240101123457');
      expect(result1.fileName).not.toBe(result2.fileName);
    });
  });

  describe('bundled migration generation', () => {
    let template2: TemplateMetadata;

    beforeEach(() => {
      template2 = {
        name: 'create_posts',
        templatePath: '/test/project/templates/create_posts.sql',
        relativePath: 'templates/create_posts.sql',
        content: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT);',
        hash: 'def456',
        lastBuildAt: '20240101000001_test-create_posts.sql',
      };
    });

    it('should generate bundled migration with multiple templates', async () => {
      const templates = [templateMetadata, template2];
      const result = await builder.generateBundledMigration(templates, mockBuildLog);

      expect(result.fileName).toBe('20240101123456_test-bundle.sql');
      expect(result.filePath).toBe('migrations/20240101123456_test-bundle.sql');
      expect(result.timestamp).toBe('20240101123456');
      expect(result.includedTemplates).toEqual(['create_users', 'create_posts']);

      const content = result.content;
      expect(content).toContain('-- Template: templates/create_users.sql');
      expect(content).toContain('-- Template: templates/create_posts.sql');
      expect(content).toContain('CREATE TABLE users');
      expect(content).toContain('CREATE TABLE posts');
    });

    it('should generate bundled migration without transaction wrapping', async () => {
      const templates = [templateMetadata, template2];
      const result = await builder.generateBundledMigration(templates, mockBuildLog, {
        wrapInTransaction: false,
      });

      const content = result.content;
      expect(content).not.toContain('BEGIN;');
      expect(content).not.toContain('COMMIT;');
    });

    it('should handle empty template list for bundle', async () => {
      const result = await builder.generateBundledMigration([], mockBuildLog);

      expect(result.includedTemplates).toHaveLength(0);
      expect(result.content.trim()).toBe('');
    });
  });

  describe('file writing operations', () => {
    it('should write migration file to disk', async () => {
      const migrationResult = await builder.generateMigration(templateMetadata, mockBuildLog);
      const filePath = await builder.writeMigration(migrationResult);

      expect(fs.mkdir).toHaveBeenCalledWith('/test/project/migrations', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/project/migrations/20240101123456_test-create_users.sql',
        migrationResult.content,
        'utf-8'
      );
      expect(filePath).toBe('/test/project/migrations/20240101123456_test-create_users.sql');
    });

    it('should write bundled migration file to disk', async () => {
      const templates = [templateMetadata];
      const migrationResult = await builder.generateBundledMigration(templates, mockBuildLog);
      const filePath = await builder.writeBundledMigration(migrationResult);

      expect(fs.mkdir).toHaveBeenCalledWith('/test/project/migrations', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/project/migrations/20240101123456_test-bundle.sql',
        migrationResult.content,
        'utf-8'
      );
      expect(filePath).toBe('/test/project/migrations/20240101123456_test-bundle.sql');
    });

    it('should generate and write migration in one operation', async () => {
      const { result, filePath } = await builder.generateAndWriteMigration(
        templateMetadata,
        mockBuildLog
      );

      expect(result.fileName).toBe('20240101123456_test-create_users.sql');
      expect(filePath).toBe('/test/project/migrations/20240101123456_test-create_users.sql');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should generate and write bundled migration in one operation', async () => {
      const templates = [templateMetadata];
      const { result, filePath } = await builder.generateAndWriteBundledMigration(
        templates,
        mockBuildLog
      );

      expect(result.fileName).toBe('20240101123456_test-bundle.sql');
      expect(filePath).toBe('/test/project/migrations/20240101123456_test-bundle.sql');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle file writing errors', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const migrationResult = await builder.generateMigration(templateMetadata, mockBuildLog);

      await expect(builder.writeMigration(migrationResult)).rejects.toThrow('Permission denied');
    });

    it('should handle directory creation errors', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Cannot create directory'));

      const migrationResult = await builder.generateMigration(templateMetadata, mockBuildLog);

      await expect(builder.writeMigration(migrationResult)).rejects.toThrow(
        'Cannot create directory'
      );
    });
  });

  describe('migration existence checking', () => {
    it('should return false when migration does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const exists = await builder.migrationExists('20240101123456_test-create_users.sql');

      expect(exists).toBe(false);
      expect(fs.access).toHaveBeenCalledWith(
        '/test/project/migrations/20240101123456_test-create_users.sql'
      );
    });

    it('should return true when migration exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const exists = await builder.migrationExists('20240101123456_test-create_users.sql');

      expect(exists).toBe(true);
    });
  });

  describe('path generation utilities', () => {
    it('should generate correct migration path', () => {
      const migrationPath = builder.getMigrationPath('create_users', '20240101123456');

      expect(migrationPath).toBe('migrations/20240101123456_test-create_users.sql');
    });

    it('should generate correct absolute migration path', () => {
      const absolutePath = builder.getAbsoluteMigrationPath('create_users', '20240101123456');

      expect(absolutePath).toBe('/test/project/migrations/20240101123456_test-create_users.sql');
    });

    it('should handle migration paths without prefix', () => {
      const noPrefixBuilder = new MigrationBuilder({
        ...config,
        migrationPrefix: '',
      });

      const migrationPath = noPrefixBuilder.getMigrationPath('create_users', '20240101123456');

      expect(migrationPath).toBe('migrations/20240101123456_create_users.sql');
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle empty template content', async () => {
      const emptyTemplate = {
        ...templateMetadata,
        content: '',
      };

      const result = await builder.generateMigration(emptyTemplate, mockBuildLog);

      expect(result.content).toContain('BEGIN;');
      expect(result.content).toContain('COMMIT;');
      expect(result.content).not.toContain('CREATE TABLE');
    });

    it('should handle template with special characters in name', async () => {
      const specialTemplate = {
        ...templateMetadata,
        name: 'create-users_v2.final',
      };

      const result = await builder.generateMigration(specialTemplate, mockBuildLog);

      expect(result.fileName).toBe('20240101123456_test-create-users_v2.final.sql');
    });

    it('should handle very long template content', async () => {
      const longContent = 'CREATE TABLE test (' + 'col TEXT, '.repeat(1000) + 'id SERIAL);';
      const longTemplate = {
        ...templateMetadata,
        content: longContent,
      };

      const result = await builder.generateMigration(longTemplate, mockBuildLog);

      expect(result.content).toContain(longContent);
      expect(result.content.length).toBeGreaterThan(longContent.length);
    });

    it('should handle template with multiline SQL', async () => {
      const multilineContent = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        );
        
        CREATE INDEX idx_users_email ON users(email);
      `;

      const multilineTemplate = {
        ...templateMetadata,
        content: multilineContent,
      };

      const result = await builder.generateMigration(multilineTemplate, mockBuildLog);

      expect(result.content).toContain('CREATE TABLE users');
      expect(result.content).toContain('CREATE INDEX idx_users_email');
    });

    it('should handle BuildLog updates correctly', async () => {
      const initialTimestamp = mockBuildLog.lastTimestamp;

      await builder.generateMigration(templateMetadata, mockBuildLog);

      expect(getNextTimestamp).toHaveBeenCalledWith(mockBuildLog);
      // BuildLog should be modified by getNextTimestamp
    });

    it('should maintain configuration immutability', () => {
      const originalConfig = builder.getConfig();
      const modifiedConfig = originalConfig;
      modifiedConfig.banner = 'Modified banner';

      const currentConfig = builder.getConfig();
      expect(currentConfig.banner).toBe('Auto-generated migration');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent migration generation', async () => {
      vi.mocked(getNextTimestamp)
        .mockResolvedValueOnce('20240101123456')
        .mockResolvedValueOnce('20240101123457')
        .mockResolvedValueOnce('20240101123458');

      const templates = [templateMetadata, templateMetadata, templateMetadata];
      const promises = templates.map((template, i) =>
        builder.generateMigration({ ...template, name: `template_${i}` }, mockBuildLog)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].timestamp).toBe('20240101123456');
      expect(results[1].timestamp).toBe('20240101123457');
      expect(results[2].timestamp).toBe('20240101123458');

      // All should have unique filenames
      const filenames = results.map(r => r.fileName);
      const uniqueFilenames = new Set(filenames);
      expect(uniqueFilenames.size).toBe(3);
    });
  });
});
