import React from 'react';
import chalk from 'chalk';
import { describe, test, expect } from 'vitest';
import { render } from 'ink-testing-library';
import Index from '../commands/index.js';

describe('Index component', () => {
  test('should greet user', () => {
    const { lastFrame } = render(<Index />);
    expect(lastFrame()).toBe(`Hello, ${chalk.green('Jane')}`);
  });
});
