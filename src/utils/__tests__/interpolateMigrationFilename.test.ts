/**
 * Tests for interpolateMigrationFilename utility
 * Implements template variable substitution for migration paths
 */

import { describe, expect, it } from 'vitest';
import { interpolateMigrationFilename } from '../interpolateMigrationFilename.js';

describe('interpolateMigrationFilename', () => {
  describe('default template (backward compatibility)', () => {
    it('should generate filename matching current behavior with prefix', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp_$prefix$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: 'srtd',
      });
      expect(result).toBe('20240101123456_srtd-create_users.sql');
    });

    it('should generate filename matching current behavior without prefix', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp_$prefix$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: '',
      });
      expect(result).toBe('20240101123456_create_users.sql');
    });

    it('should generate filename matching current behavior with undefined prefix', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp_$prefix$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: undefined,
      });
      expect(result).toBe('20240101123456_create_users.sql');
    });
  });

  describe('directory-based templates', () => {
    it('should support directory in template path', () => {
      const result = interpolateMigrationFilename({
        template: '$migrationName/migrate.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: 'srtd',
      });
      expect(result).toBe('create_users/migrate.sql');
    });

    it('should support nested directories with timestamp', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp/$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: '',
      });
      expect(result).toBe('20240101123456/create_users.sql');
    });

    it('should support complex path patterns', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp_$prefix$migrationName/$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: 'srtd',
      });
      expect(result).toBe('20240101123456_srtd-create_users/create_users.sql');
    });
  });

  describe('bundle migrations', () => {
    it('should work with bundle as migration name', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp_$prefix$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'bundle',
        prefix: 'test',
      });
      expect(result).toBe('20240101123456_test-bundle.sql');
    });

    it('should work with directory pattern for bundles', () => {
      const result = interpolateMigrationFilename({
        template: '$migrationName/migrate.sql',
        timestamp: '20240101123456',
        migrationName: 'bundle',
        prefix: 'srtd',
      });
      expect(result).toBe('bundle/migrate.sql');
    });
  });

  describe('edge cases', () => {
    it('should handle template without any variables', () => {
      const result = interpolateMigrationFilename({
        template: 'static_migration.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: 'srtd',
      });
      expect(result).toBe('static_migration.sql');
    });

    it('should handle template with only timestamp', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: 'srtd',
      });
      expect(result).toBe('20240101123456.sql');
    });

    it('should handle migration names with special characters', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp_$prefix$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create-users_v2.final',
        prefix: 'srtd',
      });
      expect(result).toBe('20240101123456_srtd-create-users_v2.final.sql');
    });

    it('should handle multiple occurrences of same variable', () => {
      const result = interpolateMigrationFilename({
        template: '$migrationName/$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: '',
      });
      expect(result).toBe('create_users/create_users.sql');
    });

    it('should handle timestamp appearing multiple times', () => {
      const result = interpolateMigrationFilename({
        template: '$timestamp/$timestamp_$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: '',
      });
      expect(result).toBe('20240101123456/20240101123456_create_users.sql');
    });
  });

  describe('prefix edge cases', () => {
    it('should add dash after prefix when prefix exists', () => {
      const result = interpolateMigrationFilename({
        template: '$prefix$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: 'my-prefix',
      });
      expect(result).toBe('my-prefix-create_users.sql');
    });

    it('should not add dash when prefix is empty string', () => {
      const result = interpolateMigrationFilename({
        template: '$prefix$migrationName.sql',
        timestamp: '20240101123456',
        migrationName: 'create_users',
        prefix: '',
      });
      expect(result).toBe('create_users.sql');
    });
  });
});
