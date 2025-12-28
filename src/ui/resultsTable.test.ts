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

  it('renders built rows with arrow format', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [
        {
          template: 'supabase/templates/functions/audit.sql',
          status: 'built',
          target: '20241227_srtd-audit.sql',
        },
      ],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('audit.sql');
    expect(output).toContain('→');
    expect(output).toContain('20241227_srtd-audit.sql');
  });

  it('renders applied rows with cyan tick', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [{ template: 'templates/func.sql', status: 'applied', target: 'migration.sql' }],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('func.sql');
    expect(output).toContain('→');
  });

  it('renders error rows with cross icon', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [{ template: 'src/views/broken.sql', status: 'error' }],
      unchanged: [],
    });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('broken.sql');
  });

  it('renders unchanged rows muted with date', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [],
      unchanged: [
        {
          template: 'path/a.sql',
          target: '20241225_srtd-a.sql',
          lastDate: '2024-12-25T14:30:00.000Z',
        },
      ],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('a.sql');
    expect(output).toContain('20241225_srtd-a.sql');
    expect(output).toContain('12/25'); // Compact date format
  });

  it('renders summary counts', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [
        { template: 'a.sql', status: 'built', target: 'out.sql' },
        { template: 'b.sql', status: 'built', target: 'out2.sql' },
      ],
      unchanged: [{ template: 'c.sql' }, { template: 'd.sql' }],
      errorCount: 1,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Built: 2');
    expect(output).toContain('Unchanged: 2');
    expect(output).toContain('Errors: 1');
  });

  it('hides unchanged count when empty', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [{ template: 'a.sql', status: 'built', target: 'out.sql' }],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).not.toContain('Unchanged');
  });

  it('handles rows without target', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [{ template: 'a.sql', status: 'applied' }],
      unchanged: [],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('a.sql');
    expect(output).toContain('→');
  });

  it('handles unchanged rows without date', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      rows: [],
      unchanged: [{ template: 'test.sql', target: 'migration.sql' }],
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('test.sql');
    expect(output).toContain('migration.sql');
  });
});
