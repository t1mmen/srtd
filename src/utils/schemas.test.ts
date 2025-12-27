import { describe, expect, it } from 'vitest';
import { validateBuildLog, validateConfig } from './schemas.js';

describe('schemas', () => {
  describe('validateBuildLog', () => {
    it('parses valid BuildLog correctly', () => {
      const validBuildLog = JSON.stringify({
        version: '1.0.0',
        lastTimestamp: '20231215120000',
        templates: {
          'templates/users.sql': {
            lastBuildHash: 'abc123',
            lastBuildDate: '2023-12-15T12:00:00Z',
          },
        },
      });

      const result = validateBuildLog(validBuildLog);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        version: '1.0.0',
        lastTimestamp: '20231215120000',
        templates: {
          'templates/users.sql': {
            lastBuildHash: 'abc123',
            lastBuildDate: '2023-12-15T12:00:00Z',
          },
        },
      });
      expect(result.error).toBeUndefined();
    });

    it('parses BuildLog with empty templates', () => {
      const validBuildLog = JSON.stringify({
        version: '1.0.0',
        lastTimestamp: '20231215120000',
        templates: {},
      });

      const result = validateBuildLog(validBuildLog);

      expect(result.success).toBe(true);
      expect(result.data?.templates).toEqual({});
    });

    it('parses BuildLog with all optional TemplateBuildState fields', () => {
      const validBuildLog = JSON.stringify({
        version: '1.0.0',
        lastTimestamp: '20231215120000',
        templates: {
          'templates/users.sql': {
            lastBuildHash: 'abc123',
            lastBuildDate: '2023-12-15T12:00:00Z',
            lastBuildError: 'some error',
            lastMigrationFile: '20231215_users.sql',
            lastAppliedHash: 'def456',
            lastAppliedDate: '2023-12-15T12:05:00Z',
            lastAppliedError: 'apply error',
          },
        },
      });

      const result = validateBuildLog(validBuildLog);

      expect(result.success).toBe(true);
      expect(result.data?.templates['templates/users.sql']).toEqual({
        lastBuildHash: 'abc123',
        lastBuildDate: '2023-12-15T12:00:00Z',
        lastBuildError: 'some error',
        lastMigrationFile: '20231215_users.sql',
        lastAppliedHash: 'def456',
        lastAppliedDate: '2023-12-15T12:05:00Z',
        lastAppliedError: 'apply error',
      });
    });

    it('fails when version is missing', () => {
      const invalidBuildLog = JSON.stringify({
        lastTimestamp: '20231215120000',
        templates: {},
      });

      const result = validateBuildLog(invalidBuildLog);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('version');
      expect(result.data).toBeUndefined();
    });

    it('fails when lastTimestamp is missing', () => {
      const invalidBuildLog = JSON.stringify({
        version: '1.0.0',
        templates: {},
      });

      const result = validateBuildLog(invalidBuildLog);

      expect(result.success).toBe(false);
      expect(result.error).toContain('lastTimestamp');
    });

    it('fails when templates is missing', () => {
      const invalidBuildLog = JSON.stringify({
        version: '1.0.0',
        lastTimestamp: '20231215120000',
      });

      const result = validateBuildLog(invalidBuildLog);

      expect(result.success).toBe(false);
      expect(result.error).toContain('templates');
    });

    it('fails gracefully on malformed JSON (truncated)', () => {
      const truncatedJson = '{"version": "1.0.0", "lastTimestamp": "2023';

      const result = validateBuildLog(truncatedJson);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('JSON');
    });

    it('fails gracefully on malformed JSON (missing brace)', () => {
      const missingBrace =
        '{"version": "1.0.0", "lastTimestamp": "20231215120000", "templates": {}';

      const result = validateBuildLog(missingBrace);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('JSON');
    });

    it('fails gracefully on empty string', () => {
      const result = validateBuildLog('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails when version is wrong type', () => {
      const invalidBuildLog = JSON.stringify({
        version: 123,
        lastTimestamp: '20231215120000',
        templates: {},
      });

      const result = validateBuildLog(invalidBuildLog);

      expect(result.success).toBe(false);
      expect(result.error).toContain('version');
    });
  });

  describe('validateConfig', () => {
    it('parses valid CLIConfig correctly', () => {
      const validConfig = JSON.stringify({
        filter: '**/*.sql',
        wipIndicator: '.wip',
        wrapInTransaction: true,
        banner: '-- Banner',
        footer: '-- Footer',
        templateDir: 'supabase/migrations-templates',
        migrationDir: 'supabase/migrations',
        buildLog: '.buildlog.json',
        localBuildLog: '.buildlog.local.json',
        pgConnection: 'postgresql://localhost:5432/db',
      });

      const result = validateConfig(validConfig);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        filter: '**/*.sql',
        wipIndicator: '.wip',
        wrapInTransaction: true,
        banner: '-- Banner',
        footer: '-- Footer',
        templateDir: 'supabase/migrations-templates',
        migrationDir: 'supabase/migrations',
        buildLog: '.buildlog.json',
        localBuildLog: '.buildlog.local.json',
        pgConnection: 'postgresql://localhost:5432/db',
      });
    });

    it('parses CLIConfig with optional migrationPrefix', () => {
      const validConfig = JSON.stringify({
        filter: '**/*.sql',
        wipIndicator: '.wip',
        wrapInTransaction: true,
        banner: '',
        footer: '',
        templateDir: 'templates',
        migrationDir: 'migrations',
        migrationPrefix: 'custom_',
        buildLog: '.buildlog.json',
        localBuildLog: '.buildlog.local.json',
        pgConnection: 'postgresql://localhost/db',
      });

      const result = validateConfig(validConfig);

      expect(result.success).toBe(true);
      expect(result.data?.migrationPrefix).toBe('custom_');
    });

    it('fails when required field is missing', () => {
      const invalidConfig = JSON.stringify({
        filter: '**/*.sql',
        wipIndicator: '.wip',
        // missing wrapInTransaction and other required fields
      });

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails gracefully on malformed JSON', () => {
      const truncatedJson = '{"filter": "**/*.sql"';

      const result = validateConfig(truncatedJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    it('fails when wrapInTransaction is wrong type', () => {
      const invalidConfig = JSON.stringify({
        filter: '**/*.sql',
        wipIndicator: '.wip',
        wrapInTransaction: 'yes', // should be boolean
        banner: '',
        footer: '',
        templateDir: 'templates',
        migrationDir: 'migrations',
        buildLog: '.buildlog.json',
        localBuildLog: '.buildlog.local.json',
        pgConnection: 'postgresql://localhost/db',
      });

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('wrapInTransaction');
    });
  });
});
