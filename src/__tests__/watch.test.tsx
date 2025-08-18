import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock terminal-kit before any imports that use it
vi.mock('terminal-kit', () => {
  const mockTerminal = {
    clear: vi.fn(),
    processExit: vi.fn(),
    yellow: vi.fn(),
    green: vi.fn(),
    red: vi.fn(),
    cyan: vi.fn(),
    dim: vi.fn(),
    bold: vi.fn(),
    grabInput: vi.fn(),
    on: vi.fn(),
    eraseDisplayBelow: vi.fn(),
    up: vi.fn(),
    moveTo: vi.fn(),
  };

  // Make the mock callable
  Object.setPrototypeOf(mockTerminal, Function.prototype);
  (mockTerminal as any).call = vi.fn();

  return { terminal: mockTerminal };
});

import Watch from '../commands/watch.js';
import { connect } from '../utils/databaseConnection.js';

// Mock the Orchestrator
vi.mock('../lib/orchestrator.js', () => ({
  Orchestrator: class {
    initialize = vi.fn();
    getTemplateStatuses = vi.fn().mockResolvedValue([]);
    startWatching = vi.fn();
    stopWatching = vi.fn();
    destroy = vi.fn();
    on = vi.fn();
    off = vi.fn();
  },
}));

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Watch Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('starts watch mode without errors', async () => {
    await connect();

    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Start watch command
    void Watch(); // Start watch command

    // Give it time to initialize
    await wait(100);

    // Verify that the terminal was used
    const { terminal } = await import('terminal-kit');
    expect(terminal.clear).toHaveBeenCalled();
    expect(terminal.grabInput).toHaveBeenCalled();

    // Clean up
    mockExit.mockRestore();
  });
});
