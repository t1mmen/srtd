import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatZodErrors, validateBuildLog } from './schemas.js';

describe('schemas', () => {
  describe('formatZodErrors', () => {
    it('formats single error with path', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        // Zod error message includes path prefix and type info
        expect(formatted).toMatch(/^name: /);
        expect(formatted).toContain('string');
      }
    });

    it('formats multiple errors with paths', () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const result = schema.safeParse({ name: 123, age: 'not a number' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted).toContain('name:');
        expect(formatted).toContain('age:');
        expect(formatted).toContain(';');
      }
    });

    it('formats error without path (root level)', () => {
      const schema = z.string();
      const result = schema.safeParse(123);

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        // Root-level errors have no path prefix
        expect(formatted).not.toMatch(/^\w+: /);
        expect(formatted).toContain('string');
      }
    });

    it('formats nested path errors', () => {
      const schema = z.object({ user: z.object({ email: z.string() }) });
      const result = schema.safeParse({ user: { email: 42 } });

      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        // Nested paths are dot-separated
        expect(formatted).toMatch(/^user\.email: /);
        expect(formatted).toContain('string');
      }
    });
  });

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
});
