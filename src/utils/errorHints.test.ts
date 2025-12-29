import { describe, expect, it } from 'vitest';
import { getErrorHint } from './errorHints.js';

describe('getErrorHint', () => {
  describe('known Postgres error codes', () => {
    it('returns hint for column does not exist (42703)', () => {
      const hint = getErrorHint('42703', 'column "foo" does not exist');
      expect(hint).toContain('Column');
      expect(hint).toContain('spelling');
    });

    it('returns hint for table does not exist (42P01)', () => {
      const hint = getErrorHint('42P01', 'relation "users" does not exist');
      expect(hint).toContain('Table');
      expect(hint).toContain('migration');
    });

    it('returns hint for function does not exist (42883)', () => {
      const hint = getErrorHint('42883', 'function my_func() does not exist');
      expect(hint).toContain('Function');
    });

    it('returns hint for unique constraint violation (23505)', () => {
      const hint = getErrorHint('23505', 'duplicate key value violates unique constraint');
      expect(hint).toContain('Unique');
      expect(hint).toContain('duplicate');
    });

    it('returns hint for foreign key violation (23503)', () => {
      const hint = getErrorHint('23503', 'foreign key constraint');
      expect(hint).toContain('Foreign key');
    });

    it('returns hint for syntax error (42601)', () => {
      const hint = getErrorHint('42601', 'syntax error at or near');
      expect(hint).toContain('syntax');
    });
  });

  describe('unknown errors', () => {
    it('returns undefined for unknown error code', () => {
      const hint = getErrorHint('99999', 'unknown error');
      expect(hint).toBeUndefined();
    });

    it('returns undefined when code is undefined', () => {
      const hint = getErrorHint(undefined, 'some error');
      expect(hint).toBeUndefined();
    });
  });

  describe('pattern-based fallback', () => {
    it('returns hint for permission denied pattern', () => {
      const hint = getErrorHint(undefined, 'permission denied for table users');
      expect(hint).toBeDefined();
      expect(hint?.toLowerCase()).toContain('permission');
    });

    it('returns hint for connection refused pattern', () => {
      const hint = getErrorHint(undefined, 'connection refused');
      expect(hint).toContain('database');
    });
  });
});
