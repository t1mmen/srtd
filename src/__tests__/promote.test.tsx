import { render } from 'ink-testing-library';
import React from 'react';
import { expect, it } from 'vitest';
import Promote from '../commands/promote.js';

it('renders promote command', () => {
  const { lastFrame } = render(<Promote args={undefined} />);
  expect(lastFrame()).toContain('Promote WIP template');
});
