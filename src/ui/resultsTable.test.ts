import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';

describe('renderResultsTable', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('renders table header', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('TEMPLATE');
    expect(output).toContain('STATUS');
    expect(output).toContain('OUTPUT');
  });

  it('renders built rows with truncated path', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [
        {
          template: 'supabase/templates/functions/audit.sql',
          status: 'built',
          output: '20241227_srtd-audit.sql',
        },
      ],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('…/functions/audit.sql');
    expect(output).toContain('built');
    expect(output).toContain('20241227_srtd-audit.sql');
  });

  it('renders applied rows', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [{ template: 'templates/func.sql', status: 'applied' }],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('applied');
  });

  it('renders error rows in red', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [{ template: 'src/views/broken.sql', status: 'error' }],
      unchanged: [],
    });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('…/views/broken.sql');
    expect(output).toContain('error');
  });

  it('renders unchanged as compact comma-separated line', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [],
      unchanged: ['path/a.sql', 'path/b.sql', 'path/c.sql'],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('3 unchanged');
    expect(output).toContain('a.sql');
    expect(output).toContain('b.sql');
    expect(output).toContain('c.sql');
  });

  it('truncates unchanged list when > 6 items', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [],
      unchanged: ['a.sql', 'b.sql', 'c.sql', 'd.sql', 'e.sql', 'f.sql', 'g.sql', 'h.sql'],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('8 unchanged');
    expect(output).toContain('+5 more');
  });

  it('renders summary counts', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [
        { template: 'a.sql', status: 'built', output: 'out.sql' },
        { template: 'b.sql', status: 'built', output: 'out2.sql' },
      ],
      unchanged: ['c.sql', 'd.sql'],
      errorCount: 1,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Built: 2');
    expect(output).toContain('Unchanged: 2');
    expect(output).toContain('Errors: 1');
  });

  it('hides unchanged line when empty', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [{ template: 'a.sql', status: 'built', output: 'out.sql' }],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).not.toContain('unchanged');
  });
});
