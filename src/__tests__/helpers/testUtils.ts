/**
 * Shared test utilities for reducing boilerplate across test files
 *
 * IMPORTANT: Command tests must capture BOTH console.log AND console.error.
 * Commander.js writes parse errors to stderr (console.error), not stdout.
 * If console.error is not captured, parse errors silently pass tests!
 */

import { vi } from 'vitest';

/**
 * Create a mock for console.log that returns undefined (lint-compliant)
 * @returns Spy that can be restored in afterEach
 */
export function mockConsoleLog() {
  return vi.spyOn(console, 'log').mockImplementation(() => undefined);
}

/**
 * Create a mock for console.error that returns undefined (lint-compliant)
 * CRITICAL: Commander.js writes parse errors to console.error!
 * @returns Spy that can be restored in afterEach
 */
export function mockConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

/**
 * Create a mock for console.clear that returns undefined (lint-compliant)
 * @returns Spy that can be restored in afterEach
 */
export function mockConsoleClear() {
  return vi.spyOn(console, 'clear').mockImplementation(() => undefined);
}

/**
 * Create a mock for process.exit that doesn't actually exit
 * @returns Spy that can be restored in afterEach
 */
export function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
}

/**
 * Create a mock for process.stdout.write to suppress Commander help output
 * Commander uses process.stdout.write directly, not console.log
 * @returns Spy that can be restored in afterEach
 */
export function mockStdout() {
  // Handle all overloads of process.stdout.write
  return vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((_chunk: unknown, _encoding?: unknown, _callback?: unknown) => {
      // Call callback if provided (for async writes)
      if (typeof _encoding === 'function') {
        _encoding();
      } else if (typeof _callback === 'function') {
        _callback();
      }
      return true;
    });
}

/**
 * Create an Error with a code property (like pg errors)
 * Avoids `as any` casts in tests
 */
export function createErrorWithCode(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

/**
 * Standard mock factory for the UI module
 * Used by most command tests
 */
export function createMockUiModule() {
  return {
    renderBranding: vi.fn().mockResolvedValue(undefined),
    createSpinner: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
      text: '',
    })),
    renderResults: vi.fn(),
  };
}

/**
 * Standard mock factory for findProjectRoot
 * @param projectRoot - The path to return (default: '/test/project')
 */
export function createMockFindProjectRoot(projectRoot = '/test/project') {
  return {
    findProjectRoot: vi.fn().mockResolvedValue(projectRoot),
  };
}

/**
 * Setup common command test spies (console.log + console.error + process.exit)
 * Call in beforeEach, returns cleanup function for afterEach
 *
 * IMPORTANT: console.error is captured because Commander.js writes parse errors
 * there. Without this, tests can pass even when commands fail to parse!
 */
export function setupCommandTestSpies() {
  const consoleLogSpy = mockConsoleLog();
  const consoleErrorSpy = mockConsoleError();
  const exitSpy = mockProcessExit();

  return {
    consoleLogSpy,
    consoleErrorSpy,
    exitSpy,
    /**
     * Verify no unexpected errors were written to stderr.
     * Call this after parseAsync to catch Commander parse errors.
     */
    assertNoStderr: () => {
      const stderrOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      if (stderrOutput.length > 0) {
        throw new Error(`Unexpected stderr output:\n${stderrOutput}`);
      }
    },
    cleanup: () => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      exitSpy.mockRestore();
    },
  };
}
