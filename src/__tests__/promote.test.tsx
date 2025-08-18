import { describe, expect, it, vi } from 'vitest';
import Promote from '../commands/promote.js';

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
  singleLineMenu: vi.fn((_items: any, _options: any, callback: any) => {
    // Simulate menu selection
    if (callback) {
      setTimeout(() => callback(null, { selectedIndex: 0 }), 10);
    }
  }),
};

// Make the mock callable
Object.setPrototypeOf(mockTerminal, Function.prototype);
(mockTerminal as any).call = vi.fn();

vi.mock('terminal-kit', () => ({
  terminal: mockTerminal,
}));

// Mock the Orchestrator
vi.mock('../lib/orchestrator.js', () => ({
  Orchestrator: class {
    initialize = vi.fn();
    getTemplateStatuses = vi.fn().mockResolvedValue([]);
    promoteTemplates = vi.fn().mockResolvedValue([]);
    destroy = vi.fn();
  },
}));

describe('Promote Command', () => {
  it('executes without errors', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await Promote({ args: undefined });
    } catch (error) {
      // Expected to throw due to mocked process.exit
      expect(String(error)).toContain('process.exit called');
    }

    // Verify that the terminal was used
    expect(mockTerminal.yellow).toHaveBeenCalled();

    mockExit.mockRestore();
  });
});
