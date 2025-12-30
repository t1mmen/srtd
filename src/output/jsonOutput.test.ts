import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateResult } from '../ui/types.js';
import {
  createBaseJsonOutput,
  formatFatalError,
  formatJsonOutput,
  writeJson,
} from './jsonOutput.js';

describe('formatJsonOutput', () => {
  it('creates correct envelope structure', () => {
    const results: TemplateResult[] = [{ template: 'test.sql', status: 'success' }];

    const output = formatJsonOutput(results, 'apply');

    expect(output.success).toBe(true);
    expect(output.command).toBe('apply');
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(output.results).toHaveLength(1);
  });

  it('calculates summary counts correctly', () => {
    const results: TemplateResult[] = [
      { template: 'a.sql', status: 'success' },
      { template: 'b.sql', status: 'success' },
      { template: 'c.sql', status: 'unchanged' },
      { template: 'd.sql', status: 'error', errorMessage: 'failed' },
      { template: 'e.sql', status: 'skipped' },
    ];

    const output = formatJsonOutput(results, 'build');

    expect(output.summary).toEqual({
      total: 5,
      success: 2,
      error: 1,
      unchanged: 1,
      skipped: 1,
    });
  });

  it('counts built status as success in summary', () => {
    const results: TemplateResult[] = [
      { template: 'a.sql', status: 'built' },
      { template: 'b.sql', status: 'success' },
    ];

    const output = formatJsonOutput(results, 'build');

    expect(output.summary.success).toBe(2);
  });

  it('sets success to false when errors exist', () => {
    const results: TemplateResult[] = [
      { template: 'a.sql', status: 'error', errorMessage: 'failed' },
    ];

    const output = formatJsonOutput(results, 'apply');

    expect(output.success).toBe(false);
  });

  it('serializes Date timestamps to ISO strings', () => {
    const date = new Date('2024-12-30T10:00:00Z');
    const results: TemplateResult[] = [
      { template: 'test.sql', status: 'unchanged', timestamp: date },
    ];

    const output = formatJsonOutput(results, 'apply');
    const jsonString = JSON.stringify(output);
    const parsed = JSON.parse(jsonString);

    expect(parsed.results[0].timestamp).toBe('2024-12-30T10:00:00.000Z');
  });
});

describe('writeJson', () => {
  it('should write JSON to stdout with newline', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    writeJson({ foo: 'bar' });

    expect(writeSpy).toHaveBeenCalledWith('{\n  "foo": "bar"\n}\n');
    writeSpy.mockRestore();
  });

  it('should handle nested objects', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    writeJson({ outer: { inner: 'value' } });

    expect(writeSpy).toHaveBeenCalledWith('{\n  "outer": {\n    "inner": "value"\n  }\n}\n');
    writeSpy.mockRestore();
  });

  it('should handle arrays', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    writeJson({ items: [1, 2, 3] });

    expect(writeSpy).toHaveBeenCalledWith('{\n  "items": [\n    1,\n    2,\n    3\n  ]\n}\n');
    writeSpy.mockRestore();
  });
});

describe('createBaseJsonOutput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-30T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create base output with success', () => {
    const output = createBaseJsonOutput('init', true);

    expect(output).toEqual({
      success: true,
      command: 'init',
      timestamp: '2024-12-30T10:00:00.000Z',
    });
  });

  it('should create base output with failure', () => {
    const output = createBaseJsonOutput('build', false);

    expect(output).toEqual({
      success: false,
      command: 'build',
      timestamp: '2024-12-30T10:00:00.000Z',
    });
  });

  it('should include error when provided', () => {
    const output = createBaseJsonOutput('clear', false, 'Something went wrong');

    expect(output).toEqual({
      success: false,
      command: 'clear',
      timestamp: '2024-12-30T10:00:00.000Z',
      error: 'Something went wrong',
    });
  });

  it('should not include error key when undefined', () => {
    const output = createBaseJsonOutput('apply', true);

    expect(output).not.toHaveProperty('error');
  });

  it('should work with all command names', () => {
    const commands = ['init', 'build', 'apply', 'watch', 'register', 'promote', 'clear'] as const;

    for (const cmd of commands) {
      const output = createBaseJsonOutput(cmd, true);
      expect(output.command).toBe(cmd);
    }
  });
});

describe('formatFatalError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-30T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format fatal error for build command', () => {
    const output = formatFatalError('build', 'Database connection failed');

    expect(output).toEqual({
      success: false,
      command: 'build',
      timestamp: '2024-12-30T10:00:00.000Z',
      error: 'Database connection failed',
      results: [],
      summary: { total: 0, success: 0, error: 1, unchanged: 0, skipped: 0 },
    });
  });

  it('should format fatal error for apply command', () => {
    const output = formatFatalError('apply', 'No templates found');

    expect(output.command).toBe('apply');
    expect(output.success).toBe(false);
    expect(output.error).toBe('No templates found');
  });

  it('should include empty results array', () => {
    const output = formatFatalError('build', 'Error');

    expect(output.results).toEqual([]);
  });

  it('should set error count to 1 in summary', () => {
    const output = formatFatalError('apply', 'Error');

    expect(output.summary.error).toBe(1);
    expect(output.summary.total).toBe(0);
    expect(output.summary.success).toBe(0);
  });
});
