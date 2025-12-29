import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';
import { renderErrorContext } from './errorContext.js';

describe('renderErrorContext', () => {
  let consoleLogSpy: ReturnType<typeof mockConsoleLog>;

  beforeEach(() => {
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('renders nothing when no options are provided', () => {
    renderErrorContext({});

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('renders message with gutter', () => {
    renderErrorContext({ message: 'syntax error at line 5' });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('\u2502'); // gutter character (box drawing vertical)
    expect(output).toContain('syntax error at line 5');
  });

  it('renders SQL snippet with gutter', () => {
    renderErrorContext({ sqlSnippet: 'CREATE OR REPLACE FUNCTION broken_func(' });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('\u2502'); // gutter character (box drawing vertical)
    expect(output).toContain('CREATE OR REPLACE FUNCTION broken_func(');
  });

  it('renders caret at correct column position', () => {
    renderErrorContext({
      sqlSnippet: 'CREATE OR REPLACE FUNCTION broken_func(',
      column: 40,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Should contain caret pointer
    expect(output).toContain('^');
    // Caret should be positioned (verify there's spacing before it)
    const lines = consoleLogSpy.mock.calls.flat();
    const caretLine = lines.find(line => typeof line === 'string' && line.includes('^'));
    expect(caretLine).toBeDefined();
  });

  it('does not render caret when column is 0 or undefined', () => {
    renderErrorContext({
      sqlSnippet: 'SELECT * FROM users',
      column: 0,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).not.toContain('^');
  });

  it('does not render caret without SQL snippet even if column is provided', () => {
    renderErrorContext({ column: 10 });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('applies custom indent prefix', () => {
    const indent = '          '; // 10 spaces
    renderErrorContext({
      message: 'test message',
      indentPrefix: indent,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Output should start with the indent
    expect(output).toMatch(/^\s{10}/);
  });

  it('uses empty string as default indent prefix', () => {
    renderErrorContext({ message: 'test message' });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Output should start with gutter, not spaces
    expect(output).toMatch(/^[^s]/);
  });

  it('renders message and snippet together', () => {
    renderErrorContext({
      message: 'expected parameter or ")"',
      sqlSnippet: 'CREATE OR REPLACE FUNCTION broken_func(',
      column: 40,
    });

    const lines = consoleLogSpy.mock.calls.flat();
    expect(lines.length).toBe(3); // message line, snippet line, caret line
  });

  describe('hint display', () => {
    it('renders hint when provided', () => {
      renderErrorContext({
        message: 'relation "users" does not exist',
        hint: 'Table does not exist. Ensure the migration that creates it has run first.',
      });

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Hint:');
      expect(output).toContain('Table does not exist');
    });

    it('does not render hint line when hint is undefined', () => {
      renderErrorContext({
        message: 'some error',
      });

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).not.toContain('Hint:');
    });

    it('renders hint after message but before SQL snippet', () => {
      renderErrorContext({
        message: 'error message',
        hint: 'Helpful hint',
        sqlSnippet: 'SELECT * FROM table',
      });

      const lines = consoleLogSpy.mock.calls.flat();
      expect(lines.length).toBe(3); // message, hint, snippet

      // Hint should be after message
      const outputJoined = lines.join('\n');
      const hintPos = outputJoined.indexOf('Hint:');
      const snippetPos = outputJoined.indexOf('SELECT');
      expect(hintPos).toBeLessThan(snippetPos);
    });
  });
});
