import { afterEach, beforeEach, describe } from 'node:test';
import { render } from 'ink-testing-library';
import React from 'react';
import { expect, it, vi } from 'vitest';
import Init from '../commands/init.js';

const mockFS = () => {
  vi.mock('node:fs/promises', () => ({
    default: {
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
    },
  }));
};

describe('Init Command', () => {
  beforeEach(() => {
    mockFS();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders init command', () => {
    const { lastFrame } = render(<Init />);
    expect(lastFrame()).toBe('');
  });
});
