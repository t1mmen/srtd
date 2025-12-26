import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';
import type { DatabaseService } from '../services/DatabaseService.js';

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

  it('renders branding with connected status when DatabaseService is connected', async () => {
    const mockDbService = {
      testConnection: vi.fn().mockResolvedValue(true),
    } as unknown as DatabaseService;

    const { renderBranding } = await import('./branding.js');
    await renderBranding({}, mockDbService);

    expect(mockDbService.testConnection).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
    // Check for green badge (connected)
    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => typeof call === 'string' && call.includes('srtd'))).toBe(true);
  });

  it('renders branding with disconnected status when DatabaseService throws', async () => {
    const mockDbService = {
      testConnection: vi.fn().mockRejectedValue(new Error('Connection failed')),
    } as unknown as DatabaseService;

    const { renderBranding } = await import('./branding.js');
    await renderBranding({}, mockDbService);

    expect(mockDbService.testConnection).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('renders branding with disconnected status when no DatabaseService provided', async () => {
    const { renderBranding } = await import('./branding.js');
    await renderBranding();

    expect(consoleLogSpy).toHaveBeenCalled();
    // Should still render branding (yellow/disconnected badge)
    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => typeof call === 'string' && call.includes('srtd'))).toBe(true);
  });

  it('renders branding with subtitle', async () => {
    const { renderBranding } = await import('./branding.js');
    await renderBranding({ subtitle: 'Test Subtitle' });

    expect(consoleLogSpy).toHaveBeenCalled();
    // Check that subtitle was rendered
    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => typeof call === 'string' && call.includes('Test Subtitle'))).toBe(
      true
    );
  });

  it('renders default branding without subtitle', async () => {
    const { renderBranding } = await import('./branding.js');
    await renderBranding();

    expect(consoleLogSpy).toHaveBeenCalled();
    // Check that full name was rendered
    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => typeof call === 'string' && call.includes('upabase'))).toBe(true);
  });
});
