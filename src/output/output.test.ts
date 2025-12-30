import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateResult } from '../ui/types.js';
import { output } from './output.js';

describe('output', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
  });

  it('outputs valid JSON when json context is true', () => {
    const results: TemplateResult[] = [{ template: 'test.sql', status: 'success' }];

    output({
      results,
      context: { command: 'apply', json: true },
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const outputStr = stdoutWriteSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(outputStr);
    expect(parsed.success).toBe(true);
    expect(parsed.command).toBe('apply');
  });

  it('calls renderResultsTable when json context is false', () => {
    const results: TemplateResult[] = [{ template: 'test.sql', status: 'success' }];

    output({
      results,
      context: { command: 'apply', json: false },
    });

    // Human output uses console.log (via renderResultsTable)
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('calls renderResultsTable when json context is undefined', () => {
    const results: TemplateResult[] = [{ template: 'test.sql', status: 'success' }];

    output({
      results,
      context: { command: 'apply' },
    });

    // Human output uses console.log (via renderResultsTable)
    expect(consoleLogSpy).toHaveBeenCalled();
    // Should NOT use stdout.write for JSON
    expect(stdoutWriteSpy).not.toHaveBeenCalled();
  });
});
