import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';
import {
  DEFAULT_WATCH_SHORTCUTS,
  renderWatchFooter,
  type WatchFooterShortcut,
} from './watchFooter.js';

describe('renderWatchFooter', () => {
  let consoleLogSpy: ReturnType<typeof mockConsoleLog>;

  beforeEach(() => {
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('renders blank line for spacing', () => {
    renderWatchFooter();

    // First call should be blank line for spacing
    expect(consoleLogSpy.mock.calls[0]).toEqual([]);
  });

  it('renders default shortcuts when no options provided', () => {
    renderWatchFooter();

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Default shortcuts: q quit, u toggle unchanged, b build all
    expect(output).toContain('q');
    expect(output).toContain('quit');
    expect(output).toContain('u');
    expect(output).toContain('toggle unchanged');
    expect(output).toContain('b');
    expect(output).toContain('build all');
  });

  it('renders custom shortcuts', () => {
    const customShortcuts: WatchFooterShortcut[] = [
      { key: 'r', label: 'reload' },
      { key: 'h', label: 'help' },
    ];

    renderWatchFooter({ shortcuts: customShortcuts });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('r');
    expect(output).toContain('reload');
    expect(output).toContain('h');
    expect(output).toContain('help');
    // Should NOT contain default shortcuts
    expect(output).not.toContain('quit');
    expect(output).not.toContain('toggle unchanged');
  });

  it('formats keys as dim and labels as normal text', () => {
    // We cannot easily test ANSI codes directly, but we verify the output
    // contains both key and label in the expected format "key label"
    renderWatchFooter();

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Each shortcut should appear as "key label" pattern
    expect(output).toMatch(/q\s+quit/);
    expect(output).toMatch(/u\s+toggle unchanged/);
    expect(output).toMatch(/b\s+build all/);
  });

  it('separates shortcuts with double-space', () => {
    renderWatchFooter();

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Shortcuts should be separated by at least two spaces
    // Pattern: "label  key" where label ends and key starts with double space
    expect(output).toMatch(/quit\s{2,}u/);
    expect(output).toMatch(/toggle unchanged\s{2,}b/);
  });

  it('exports DEFAULT_WATCH_SHORTCUTS constant', () => {
    expect(DEFAULT_WATCH_SHORTCUTS).toBeDefined();
    expect(Array.isArray(DEFAULT_WATCH_SHORTCUTS)).toBe(true);
    expect(DEFAULT_WATCH_SHORTCUTS).toHaveLength(3);
    expect(DEFAULT_WATCH_SHORTCUTS[0]).toEqual({ key: 'q', label: 'quit' });
    expect(DEFAULT_WATCH_SHORTCUTS[1]).toEqual({ key: 'u', label: 'toggle unchanged' });
    expect(DEFAULT_WATCH_SHORTCUTS[2]).toEqual({ key: 'b', label: 'build all' });
  });

  it('handles empty shortcuts array', () => {
    renderWatchFooter({ shortcuts: [] });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    // Should not have any shortcut text (no keys/labels)
    expect(output).not.toContain('q');
    expect(output).not.toContain('quit');
  });

  describe('destination display', () => {
    it('renders destination path when provided', () => {
      renderWatchFooter({
        destination: '/path/to/migrations',
        shortcuts: [{ key: 'q', label: 'quit' }],
      });

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('dest:');
      expect(output).toContain('migrations');
    });

    it('omits destination line when not provided', () => {
      renderWatchFooter({
        shortcuts: [{ key: 'q', label: 'quit' }],
      });

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).not.toContain('dest:');
    });

    it('renders destination before shortcuts', () => {
      renderWatchFooter({
        destination: 'supabase/migrations',
        shortcuts: [{ key: 'q', label: 'quit' }],
      });

      // Get the calls in order (excluding empty blank line)
      const nonEmptyCalls = consoleLogSpy.mock.calls.filter(call => call.length > 0);
      expect(nonEmptyCalls.length).toBe(2);

      // First non-empty call should be destination
      const destCall = nonEmptyCalls[0][0] as string;
      expect(destCall).toContain('dest:');
      expect(destCall).toContain('supabase/migrations');

      // Second call should be shortcuts
      const shortcutsCall = nonEmptyCalls[1][0] as string;
      expect(shortcutsCall).toContain('quit');
    });
  });
});
