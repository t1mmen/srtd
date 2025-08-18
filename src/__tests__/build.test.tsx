import { describe, expect, test, vi } from 'vitest';

// Mock terminal-kit before any imports
vi.mock('terminal-kit', () => ({
  terminal: {
    clear: vi.fn(),
    processExit: vi.fn(),
    yellow: vi.fn(() => ({ (): void => {} })),
    green: vi.fn(() => ({ (): void => {} })),
    red: vi.fn(() => ({ (): void => {} })),
    cyan: vi.fn(() => ({ (): void => {} })),
    dim: vi.fn(() => ({ (): void => {} })),
    bold: vi.fn(() => ({ (): void => {} })),
    grabInput: vi.fn(),
    on: vi.fn(),
    eraseDisplayBelow: vi.fn(),
    up: vi.fn(),
  },
}));

vi.mock('../components/Branding.js', () => ({
  Branding: class {
    mount() {}
    render() {}
  },
}));

describe('Build Command', () => {
  test.skip('command module exports default function', async () => {
    const module = await import('../commands/build.js');
    expect(typeof module.default).toBe('function');
  });
});
