import { render } from 'ink-testing-library';
import React from 'react';
import { expect, it } from 'vitest';
import Register from '../commands/register.js';

it('renders init command', () => {
  const { lastFrame } = render(<Register args={undefined} />);
  expect(lastFrame()).toContain('Register templates');
});
