import { render } from 'ink-testing-library';
import React from 'react';
import { expect, it } from 'vitest';
import Clear from '../commands/clear.js';

it('renders clear command', () => {
  const { lastFrame } = render(<Clear />);
  expect(lastFrame()).toContain('Clear local build logs');
  expect(lastFrame()).toContain('Clear shared build logs');
  expect(lastFrame()).toContain('Reset config');
});
