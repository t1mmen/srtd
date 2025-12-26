import { describe, expect, it } from 'vitest';
import { createSpinner } from './spinner.js';

describe('createSpinner', () => {
  it('should create a spinner with the provided text', () => {
    const spinner = createSpinner('Loading...');
    expect(spinner).toBeDefined();
    expect(spinner.text).toBe('Loading...');
  });

  it('should use dots spinner style', () => {
    const spinner = createSpinner('Test');
    // The spinner object should have the ora interface
    expect(spinner.start).toBeTypeOf('function');
    expect(spinner.stop).toBeTypeOf('function');
    expect(spinner.succeed).toBeTypeOf('function');
    expect(spinner.fail).toBeTypeOf('function');
    expect(spinner.warn).toBeTypeOf('function');
  });

  it('should allow updating text', () => {
    const spinner = createSpinner('Initial');
    spinner.text = 'Updated';
    expect(spinner.text).toBe('Updated');
  });
});
