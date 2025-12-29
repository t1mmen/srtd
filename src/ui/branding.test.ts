import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';

describe('renderBranding', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('renders branding with blue badge', async () => {
    const { renderBranding } = await import('./branding.js');
    renderBranding();

    expect(consoleLogSpy).toHaveBeenCalled();
    // Check for srtd badge
    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => typeof call === 'string' && call.includes('srtd'))).toBe(true);
  });

  it('renders branding with subtitle', async () => {
    const { renderBranding } = await import('./branding.js');
    renderBranding({ subtitle: 'Test Subtitle' });

    expect(consoleLogSpy).toHaveBeenCalled();
    // Check that subtitle was rendered
    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => typeof call === 'string' && call.includes('Test Subtitle'))).toBe(
      true
    );
  });

  it('renders default branding without subtitle', async () => {
    const { renderBranding } = await import('./branding.js');
    renderBranding();

    expect(consoleLogSpy).toHaveBeenCalled();
    // Check that full name was rendered (Supabase Repeatable Template Definitions)
    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => typeof call === 'string' && call.includes('upabase'))).toBe(true);
  });
});
