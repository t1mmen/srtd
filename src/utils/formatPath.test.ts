import { describe, expect, it } from 'vitest';
import { formatPath } from './formatPath.js';

describe('formatPath', () => {
  describe('truncatePath', () => {
    it('returns filename only when no parent directory', () => {
      expect(formatPath.truncatePath('file.sql')).toBe('file.sql');
    });

    it('shows parent folder + filename with ellipsis', () => {
      expect(formatPath.truncatePath('a/b/c/functions/audit.sql')).toBe('…/functions/audit.sql');
    });

    it('handles single parent directory', () => {
      expect(formatPath.truncatePath('templates/file.sql')).toBe('templates/file.sql');
    });

    it('handles deeply nested paths', () => {
      expect(
        formatPath.truncatePath('supabase/migrations-templates/functions/auth/audit.sql')
      ).toBe('…/auth/audit.sql');
    });

    it('handles Windows-style paths', () => {
      expect(formatPath.truncatePath('a\\b\\c\\functions\\audit.sql')).toBe(
        '…/functions/audit.sql'
      );
    });

    it('returns original if already short', () => {
      expect(formatPath.truncatePath('audit.sql')).toBe('audit.sql');
    });
  });

  describe('getFilename', () => {
    it('extracts filename from path', () => {
      expect(formatPath.getFilename('a/b/c/file.sql')).toBe('file.sql');
    });

    it('handles filename only', () => {
      expect(formatPath.getFilename('file.sql')).toBe('file.sql');
    });
  });
});
