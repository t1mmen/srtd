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

  it('renders build success rows with arrow format', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [
        {
          template: 'supabase/templates/functions/audit.sql',
          status: 'success',
          target: '20241227_srtd-audit.sql',
        },
      ],
      context: { command: 'build' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('audit.sql');
    expect(output).toContain('→');
    expect(output).toContain('20241227_srtd-audit.sql');
    expect(output).toContain('Built: 1');
  });

  it('renders apply success rows showing local db', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [{ template: 'templates/func.sql', status: 'success' }],
      context: { command: 'apply' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('func.sql');
    expect(output).toContain('→');
    expect(output).toContain('local db');
    expect(output).toContain('Applied: 1');
  });

  it('renders error rows with cross icon and no arrow', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [{ template: 'src/views/broken.sql', status: 'error' }],
      context: { command: 'build' },
    });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('broken.sql');
    expect(output).toContain('Errors: 1');
    // Error rows should not have arrow
    const lines = output.split('\n');
    const errorLine = lines.find(l => l.includes('broken.sql'));
    expect(errorLine).not.toContain('→');
  });

  it('renders unchanged rows muted with relative time', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    renderResultsTable({
      results: [
        {
          template: 'path/a.sql',
          status: 'unchanged',
          target: '20241225_srtd-a.sql',
          timestamp: threeDaysAgo,
        },
      ],
      context: { command: 'build' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('a.sql');
    expect(output).toContain('20241225_srtd-a.sql');
    expect(output).toContain('3d ago');
  });

  it('shows "No changes" when only unchanged results', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [
        { template: 'a.sql', status: 'unchanged', target: 'out.sql' },
        { template: 'b.sql', status: 'unchanged', target: 'out2.sql' },
      ],
      context: { command: 'build' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('No changes');
    expect(output).not.toContain('Built:');
  });

  it('shows summary with success and error counts', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [
        { template: 'a.sql', status: 'success', target: 'out.sql' },
        { template: 'b.sql', status: 'success', target: 'out2.sql' },
        { template: 'c.sql', status: 'error' },
      ],
      context: { command: 'build' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Built: 2');
    expect(output).toContain('Errors: 1');
  });

  it('apply command shows local db for success', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [{ template: 'a.sql', status: 'success' }],
      context: { command: 'apply' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('a.sql');
    expect(output).toContain('→');
    expect(output).toContain('local db');
  });

  it('sorts results: success first, then unchanged, then errors', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [
        { template: 'error.sql', status: 'error' },
        { template: 'unchanged.sql', status: 'unchanged' },
        { template: 'success.sql', status: 'success', target: 'out.sql' },
      ],
      context: { command: 'build' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    const successIdx = output.indexOf('success.sql');
    const unchangedIdx = output.indexOf('unchanged.sql');
    const errorIdx = output.indexOf('error.sql');
    expect(successIdx).toBeLessThan(unchangedIdx);
    expect(unchangedIdx).toBeLessThan(errorIdx);
  });

  it('handles unchanged rows without timestamp', async () => {
    const { renderResultsTable } = await import('./resultsTable.js');
    renderResultsTable({
      results: [{ template: 'test.sql', status: 'unchanged', target: 'migration.sql' }],
      context: { command: 'build' },
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('test.sql');
    expect(output).toContain('migration.sql');
  });
});
