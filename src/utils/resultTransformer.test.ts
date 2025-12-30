// src/utils/resultTransformer.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessedTemplateResult } from '../types.js';
import { toTemplateResults } from './resultTransformer.js';

describe('toTemplateResults', () => {
  const mockGetTemplateInfo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apply context', () => {
    it('transforms applied templates to success status', () => {
      const processed: ProcessedTemplateResult = {
        applied: ['template1.sql', 'template2.sql'],
        built: [],
        skipped: [],
        errors: [],
      };

      mockGetTemplateInfo.mockReturnValue({});

      const results = toTemplateResults(processed, mockGetTemplateInfo, {
        command: 'apply',
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        template: 'template1.sql',
        status: 'success',
      });
      expect(results[1]).toMatchObject({
        template: 'template2.sql',
        status: 'success',
      });
    });

    it('transforms errors with message and hint', () => {
      const processed: ProcessedTemplateResult = {
        applied: [],
        built: [],
        skipped: [],
        errors: [
          {
            file: 'broken.sql',
            error: 'syntax error',
            templateName: 'broken',
            hint: 'Check line 5',
          },
        ],
      };

      mockGetTemplateInfo.mockReturnValue({});

      const results = toTemplateResults(processed, mockGetTemplateInfo, {
        command: 'apply',
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        template: 'broken.sql',
        status: 'error',
        errorMessage: 'syntax error',
        errorHint: 'Check line 5',
      });
    });
  });

  describe('build context', () => {
    it('transforms built templates with target for build command', () => {
      const processed: ProcessedTemplateResult = {
        applied: [],
        built: ['feature.sql'],
        skipped: [],
        errors: [],
      };

      mockGetTemplateInfo.mockReturnValue({
        migrationFile: '20241230_srtd-feature.sql',
      });

      const results = toTemplateResults(processed, mockGetTemplateInfo, {
        command: 'build',
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        template: 'feature.sql',
        status: 'success',
        target: '20241230_srtd-feature.sql',
      });
    });

    it('transforms skipped templates with unchanged status and timestamp', () => {
      const processed: ProcessedTemplateResult = {
        applied: [],
        built: [],
        skipped: ['old.sql'],
        errors: [],
      };

      mockGetTemplateInfo.mockReturnValue({
        lastDate: '2024-12-25T10:00:00Z',
      });

      const results = toTemplateResults(processed, mockGetTemplateInfo, {
        command: 'apply',
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        template: 'old.sql',
        status: 'unchanged',
      });
      expect(results[0].timestamp).toBeInstanceOf(Date);
    });

    it('does NOT set target for skipped templates in apply context', () => {
      const processed: ProcessedTemplateResult = {
        applied: [],
        built: [],
        skipped: ['old.sql'],
        errors: [],
      };

      mockGetTemplateInfo.mockReturnValue({
        migrationFile: 'some_migration.sql',
        lastDate: '2024-12-25T10:00:00Z',
      });

      const results = toTemplateResults(processed, mockGetTemplateInfo, {
        command: 'apply',
      });

      expect(results[0].target).toBeUndefined();
    });

    it('marks WIP templates as skipped status in build context', () => {
      const processed: ProcessedTemplateResult = {
        applied: [],
        built: [],
        skipped: ['experiment.wip.sql'],
        errors: [],
      };

      mockGetTemplateInfo.mockReturnValue({});

      const results = toTemplateResults(
        processed,
        mockGetTemplateInfo,
        { command: 'build' },
        { wipIndicator: '.wip' }
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        template: 'experiment.wip.sql',
        status: 'skipped',
      });
    });
  });
});
