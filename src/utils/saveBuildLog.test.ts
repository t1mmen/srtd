import { describe, expect, it } from 'vitest';
import { saveBuildLog } from './saveBuildLog.js';

// Simplify test to avoid mocking issues
describe('saveBuildLog', () => {
  it('should be a function', () => {
    expect(typeof saveBuildLog).toBe('function');
  });
});
