import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';
import { renderWatchLogEntry, type WatchLogEntry } from './watchLog.js';

describe('renderWatchLogEntry', () => {
  let consoleLogSpy: ReturnType<typeof mockConsoleLog>;

  beforeEach(() => {
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('renders changed event with cyan dot', () => {
    const entry: WatchLogEntry = {
      type: 'changed',
      template: '/path/to/functions/audit_trigger.sql',
      timestamp: new Date('2024-01-15T16:45:15Z'),
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Should contain cyan bullet (we can't easily test ANSI codes, but verify content)
    expect(output).toContain('audit_trigger.sql');
    // Check for bullet character (Unicode bullet)
    expect(output).toMatch(/[●•]/);
  });

  it('renders applied event with green checkmark', () => {
    const entry: WatchLogEntry = {
      type: 'applied',
      template: '/path/to/functions/user_profile.sql',
      timestamp: new Date('2024-01-15T16:45:02Z'),
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('user_profile.sql');
    // Should contain tick/checkmark
    expect(output).toMatch(/[✔✓]/);
  });

  it('renders error event with red cross', () => {
    const entry: WatchLogEntry = {
      type: 'error',
      template: '/path/to/views/broken.sql',
      timestamp: new Date('2024-01-15T16:46:03Z'),
      message: 'syntax error at line 5',
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('broken.sql');
    // Should contain cross
    expect(output).toMatch(/[✘✗×]/);
    expect(output).toContain('syntax error at line 5');
  });

  it('includes timestamp in HH:MM:SS format', () => {
    // Create a date with known local time
    const date = new Date();
    date.setHours(14, 30, 45);
    const entry: WatchLogEntry = {
      type: 'applied',
      template: '/path/to/file.sql',
      timestamp: date,
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // formatTime.time uses local time
    expect(output).toContain('14:30:45');
  });

  it('uses truncated path', () => {
    const entry: WatchLogEntry = {
      type: 'changed',
      template: '/long/path/to/supabase/migrations-templates/functions/my_function.sql',
      timestamp: new Date(),
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Should show truncated path with ellipsis
    expect(output).toContain('functions/my_function.sql');
    // Original long path should not appear in full
    expect(output).not.toContain('/long/path/to/supabase/migrations-templates');
  });

  it('renders error with inline SQL context (gutter lines)', () => {
    const entry: WatchLogEntry = {
      type: 'error',
      template: '/path/to/broken.sql',
      timestamp: new Date('2024-01-15T16:46:03Z'),
      message: 'syntax error at line 5:',
      sqlSnippet: 'CREATE OR REPLACE FUNCTION broken_func(',
      column: 40,
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Should contain SQL snippet
    expect(output).toContain('CREATE OR REPLACE FUNCTION broken_func(');
    // Should contain gutter character
    expect(output).toContain('│');
    // Should contain caret for column pointer
    expect(output).toContain('^');
  });

  it('renders displayType for stacked events', () => {
    const entry: WatchLogEntry = {
      type: 'applied',
      template: '/path/to/broken.sql',
      timestamp: new Date('2024-01-15T16:47:22Z'),
      displayType: 'changed, applied',
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('changed, applied');
  });

  it('handles error without SQL context', () => {
    const entry: WatchLogEntry = {
      type: 'error',
      template: '/path/to/slow_view.sql',
      timestamp: new Date('2024-01-15T16:46:03Z'),
      message: 'connection timeout after 5000ms',
      // No sqlSnippet or column
    };

    renderWatchLogEntry(entry);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('slow_view.sql');
    expect(output).toContain('connection timeout after 5000ms');
    // Should NOT have caret when no column
    const lines = consoleLogSpy.mock.calls.flat();
    const caretLine = lines.find(line => typeof line === 'string' && line.includes('^'));
    expect(caretLine).toBeUndefined();
  });

  it('renders event type labels correctly', () => {
    const changedEntry: WatchLogEntry = {
      type: 'changed',
      template: '/path/to/file.sql',
      timestamp: new Date(),
    };

    const appliedEntry: WatchLogEntry = {
      type: 'applied',
      template: '/path/to/file.sql',
      timestamp: new Date(),
    };

    const errorEntry: WatchLogEntry = {
      type: 'error',
      template: '/path/to/file.sql',
      timestamp: new Date(),
      message: 'error message',
    };

    renderWatchLogEntry(changedEntry);
    let output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('changed');

    consoleLogSpy.mockClear();
    renderWatchLogEntry(appliedEntry);
    output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('applied');

    consoleLogSpy.mockClear();
    renderWatchLogEntry(errorEntry);
    output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('error');
  });
});
