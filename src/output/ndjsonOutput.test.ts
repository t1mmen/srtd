import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateResult } from '../ui/types.js';
import { ndjsonEvent, type StreamEvent, type StreamEventType } from './ndjsonOutput.js';

describe('ndjsonOutput', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let mockNow: Date;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockNow = new Date('2024-12-30T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('ndjsonEvent', () => {
    it('outputs single line of JSON with newline', () => {
      const data: TemplateResult = { template: 'test.sql', status: 'success' };

      ndjsonEvent('templateApplied', data);

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output.endsWith('\n')).toBe(true);
      // Should not contain internal newlines (NDJSON requirement)
      expect(output.trim()).not.toContain('\n');
    });

    it('includes event type and timestamp', () => {
      const data: TemplateResult = { template: 'test.sql', status: 'success' };

      ndjsonEvent('templateApplied', data);

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      const parsed: StreamEvent = JSON.parse(output);

      expect(parsed.type).toBe('templateApplied');
      expect(parsed.timestamp).toBe('2024-12-30T10:00:00.000Z');
    });

    it('data contains TemplateResult structure', () => {
      const data: TemplateResult = {
        template: 'functions/my-func.sql',
        status: 'error',
        errorMessage: 'syntax error',
        errorHint: 'check the semicolon',
      };

      ndjsonEvent('templateError', data);

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      const parsed: StreamEvent = JSON.parse(output);

      expect(parsed.data).toEqual(data);
    });

    it('handles init event with template list data', () => {
      const data = {
        templates: ['a.sql', 'b.sql'],
        needsBuild: [{ template: 'a.sql', reason: 'never-built' }],
      };

      ndjsonEvent('init', data);

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      const parsed: StreamEvent = JSON.parse(output);

      expect(parsed.type).toBe('init');
      expect(parsed.data).toEqual(data);
    });

    it('handles array of TemplateResults for buildComplete', () => {
      const data: TemplateResult[] = [
        { template: 'a.sql', status: 'built', target: '001_srtd-a.sql' },
        { template: 'b.sql', status: 'built', target: '002_srtd-b.sql' },
      ];

      ndjsonEvent('buildComplete', data);

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      const parsed: StreamEvent = JSON.parse(output);

      expect(parsed.type).toBe('buildComplete');
      expect(Array.isArray(parsed.data)).toBe(true);
      expect(parsed.data).toHaveLength(2);
    });

    it('supports all defined event types', () => {
      const eventTypes: StreamEventType[] = [
        'init',
        'templateChanged',
        'templateApplied',
        'templateError',
        'templateBuilt',
        'buildComplete',
      ];

      for (const eventType of eventTypes) {
        stdoutWriteSpy.mockClear();
        ndjsonEvent(eventType, { template: 'test.sql', status: 'success' });

        const output = stdoutWriteSpy.mock.calls[0][0] as string;
        const parsed: StreamEvent = JSON.parse(output);
        expect(parsed.type).toBe(eventType);
      }
    });

    it('outputs valid JSON that can be parsed', () => {
      const data: TemplateResult = {
        template: 'test.sql',
        status: 'success',
        timestamp: new Date('2024-12-30T09:00:00.000Z'),
      };

      ndjsonEvent('templateApplied', data);

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });
});
