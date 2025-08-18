import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Init from '../commands/init.js';

// Mock terminal-kit
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
};

// Make the mock callable
Object.setPrototypeOf(mockTerminal, Function.prototype);
(mockTerminal as any).call = vi.fn();

vi.mock('terminal-kit', () => ({
  terminal: mockTerminal,
}));

// Mock file system
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Init Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('executes without errors', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await Init();
    } catch (error) {
      // Expected to throw due to mocked process.exit
      expect(String(error)).toContain('process.exit called');
    }

    // Verify that the terminal was used
    expect(mockTerminal.yellow).toHaveBeenCalled();

    mockExit.mockRestore();
  });
});
