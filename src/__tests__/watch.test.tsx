import { render } from 'ink-testing-library';
import React from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import Watch from '../commands/watch.js';

vi.mock('ink', async importOriginal => {
  const actual = (await importOriginal()) as typeof import('ink');
  return {
    ...actual,
    useApp: () => ({ exit: vi.fn() }),
  };
});

describe('Watch Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders initial state with no templates', async () => {
    const { lastFrame } = render(<Watch />);
    await new Promise(resolve => setTimeout(resolve, 100));

    const output = lastFrame();
    expect(output).toContain('Watch Mode');
  });
});
