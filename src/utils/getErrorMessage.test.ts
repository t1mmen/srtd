import { describe, expect, it } from 'vitest';
import { getErrorMessage, isPromptExit } from './getErrorMessage.js';

describe('getErrorMessage', () => {
  it('returns message from Error instance', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  it('returns string representation of non-Error values', () => {
    expect(getErrorMessage('plain string error')).toBe('plain string error');
  });

  it('handles number values', () => {
    expect(getErrorMessage(42)).toBe('42');
  });

  it('handles null', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('handles undefined', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('handles object values', () => {
    expect(getErrorMessage({ code: 'ERR_001' })).toBe('[object Object]');
  });

  it('handles Error subclasses', () => {
    const error = new TypeError('Invalid type');
    expect(getErrorMessage(error)).toBe('Invalid type');
  });
});

describe('isPromptExit', () => {
  it('returns true for ExitPromptError', () => {
    const error = new Error('User cancelled');
    error.name = 'ExitPromptError';
    expect(isPromptExit(error)).toBe(true);
  });

  it('returns false for regular Error', () => {
    const error = new Error('Something went wrong');
    expect(isPromptExit(error)).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isPromptExit('string')).toBe(false);
    expect(isPromptExit(null)).toBe(false);
    expect(isPromptExit(undefined)).toBe(false);
    expect(isPromptExit(42)).toBe(false);
  });

  it('returns false for Error with different name', () => {
    const error = new Error('Some error');
    error.name = 'SomeOtherError';
    expect(isPromptExit(error)).toBe(false);
  });
});
