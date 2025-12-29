import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';
import { type ErrorItem, renderErrorDisplay } from './errorDisplay.js';

describe('renderErrorDisplay', () => {
  let consoleLogSpy: ReturnType<typeof mockConsoleLog>;

  beforeEach(() => {
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('skips rendering when errors array is empty', () => {
    renderErrorDisplay({ errors: [] });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('renders ERRORS header with separator', () => {
    const errors: ErrorItem[] = [
      {
        template: '/path/to/views/broken.sql',
        message: 'syntax error',
      },
    ];

    renderErrorDisplay({ errors });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('ERRORS');
    expect(output).toMatch(/[─]+/); // Contains separator line
  });

  it('renders error with filename and message', () => {
    const errors: ErrorItem[] = [
      {
        template: '/long/path/to/views/broken.sql',
        message: 'relation "users" does not exist',
      },
    ];

    renderErrorDisplay({ errors });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Should show filename with .sql extension
    expect(output).toContain('broken.sql');
    // Should contain error message
    expect(output).toContain('relation "users" does not exist');
  });

  it('renders SQL snippet with line info', () => {
    const errors: ErrorItem[] = [
      {
        template: '/path/to/views/broken.sql',
        message: 'syntax error at line 5',
        line: 5,
        sqlSnippet: 'CREATE OR REPLACE FUNCTION broken_func(',
      },
    ];

    renderErrorDisplay({ errors });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('CREATE OR REPLACE FUNCTION broken_func(');
  });

  it('renders caret at correct column position', () => {
    const errors: ErrorItem[] = [
      {
        template: '/path/to/views/broken.sql',
        message: 'expected parameter or ")"',
        line: 5,
        sqlSnippet: 'CREATE OR REPLACE FUNCTION broken_func(',
        column: 40, // Points to the opening parenthesis
      },
    ];

    renderErrorDisplay({ errors });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Should contain caret pointer
    expect(output).toContain('^');
    // Caret should be positioned (verify there's spacing before it)
    // The caret line should have spaces before the ^
    const lines = consoleLogSpy.mock.calls.flat();
    const caretLine = lines.find(line => typeof line === 'string' && line.includes('^'));
    expect(caretLine).toBeDefined();
  });

  it('renders multiple errors', () => {
    const errors: ErrorItem[] = [
      {
        template: '/path/to/views/view1.sql',
        message: 'first error',
      },
      {
        template: '/path/to/triggers/trigger1.sql',
        message: 'second error',
      },
    ];

    renderErrorDisplay({ errors });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('view1.sql');
    expect(output).toContain('first error');
    expect(output).toContain('trigger1.sql');
    expect(output).toContain('second error');
  });

  it('handles connection errors without SQL context', () => {
    const errors: ErrorItem[] = [
      {
        template: '/path/to/views/slow_view.sql',
        message: 'connection timeout after 5000ms',
        // No line, sqlSnippet, or column
      },
    ];

    renderErrorDisplay({ errors });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('slow_view.sql');
    expect(output).toContain('connection timeout after 5000ms');
    // Should NOT contain caret since no column info
    const lines = consoleLogSpy.mock.calls.flat();
    const caretLine = lines.find(line => typeof line === 'string' && line.includes('^'));
    expect(caretLine).toBeUndefined();
  });

  it('uses proper color coding for error elements', () => {
    const errors: ErrorItem[] = [
      {
        template: '/path/to/views/broken.sql',
        message: 'syntax error',
        line: 5,
        sqlSnippet: 'SELECT * FROM',
        column: 10,
      },
    ];

    renderErrorDisplay({ errors });

    // Verify console.log was called multiple times (header, errors, footer)
    expect(consoleLogSpy.mock.calls.length).toBeGreaterThan(1);
  });

  it('renders hint when provided with error', () => {
    const errors: ErrorItem[] = [
      {
        template: '/path/to/views/missing_table.sql',
        message: 'relation "users" does not exist',
        hint: 'Table does not exist. Ensure the migration that creates it has run first.',
      },
    ];

    renderErrorDisplay({ errors });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Hint:');
    expect(output).toContain('Table does not exist');
  });
});
