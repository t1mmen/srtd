import { render } from 'ink-testing-library';
import React from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import Watch from '../commands/watch.js';
import { connect } from '../utils/databaseConnection.js';

vi.mock('ink', async importOriginal => {
  const actual = (await importOriginal()) as typeof import('ink');
  return {
    ...actual,
    useApp: () => ({ exit: vi.fn() }),
  };
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Watch Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders initial state with no templates', async () => {
    await connect();
    const { lastFrame } = render(<Watch />);
    await wait(200); // Allow time for UI to render and DB to initialize

    expect(lastFrame()).toContain('Watch Mode');
    expect(lastFrame()).toContain('No templates found');
  });
});
