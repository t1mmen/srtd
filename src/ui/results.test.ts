import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';
import { renderResults } from './results.js';

describe('renderResults', () => {
  let consoleLogSpy: ReturnType<typeof mockConsoleLog>;

  beforeEach(() => {
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('renders results with built items', () => {
    renderResults(
      {
        built: ['migration1.sql', 'migration2.sql'],
        applied: [],
        skipped: [],
        errors: [],
      },
      { showBuild: true }
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Built');
    expect(output).toContain('migration1.sql');
  });

  it('renders results with applied items', () => {
    renderResults(
      {
        built: [],
        applied: ['migration1.sql'],
        skipped: [],
        errors: [],
      },
      { showApply: true }
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Applied');
  });

  it('renders results with skipped items', () => {
    renderResults({
      built: [],
      applied: [],
      skipped: ['unchanged.sql'],
      errors: [],
    });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Skipped');
  });

  it('renders results with errors', () => {
    renderResults({
      built: [],
      applied: [],
      skipped: [],
      errors: [{ templateName: 'bad.sql', error: 'Syntax error', file: 'bad.sql' }],
    });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Errors');
    expect(output).toContain('bad.sql');
  });

  it('renders stat badges', () => {
    renderResults(
      {
        built: ['a.sql', 'b.sql'],
        applied: ['a.sql'],
        skipped: ['c.sql'],
        errors: [],
      },
      { showBuild: true, showApply: true }
    );

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('limits items to 30 with overflow message', () => {
    const manyItems = Array.from({ length: 35 }, (_, i) => `item${i}.sql`);
    renderResults(
      {
        built: manyItems,
        applied: [],
        skipped: [],
        errors: [],
      },
      { showBuild: true }
    );

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('more');
  });

  it('handles empty results', () => {
    renderResults({
      built: [],
      applied: [],
      skipped: [],
      errors: [],
    });

    // Should not throw
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});
