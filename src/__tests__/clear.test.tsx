import { describe, expect, it, vi } from 'vitest';
import Clear from '../commands/clear.js';

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

// Mock the Branding component
vi.mock('../components/Branding.js', () => ({
  Branding: class {
    constructor() {}
    mount() {}
  },
}));

describe('Clear Command', () => {
  it('executes without errors', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Since clear is interactive, we need to simulate user interaction
    // The command will setup keyboard handlers but won't exit on its own
    void Clear(); // Start the clear command

    // Give it time to set up
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify that the terminal was used
    expect(mockTerminal.clear).toHaveBeenCalled();
    expect(mockTerminal.grabInput).toHaveBeenCalled();

    // Clean up
    mockExit.mockRestore();
  });
});
