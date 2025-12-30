import { describe, expect, it } from 'vitest';
import type { TemplateResult } from '../ui/types.js';
import { formatJsonOutput } from './jsonOutput.js';

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
