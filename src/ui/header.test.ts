import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockConsoleLog } from '../__tests__/helpers/testUtils.js';

describe('renderHeader', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-27T12:00:00Z'));
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.useRealTimers();
  });

  it('renders badge with subtitle and version', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'build',
      version: '0.4.7',
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('[srtd]');
    expect(output).toContain('build');
    expect(output).toContain('0.4.7');
  });

  it('renders source and destination paths', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'build',
      version: '0.4.7',
      templateDir: 'migrations-templates/',
      migrationDir: 'migrations/',
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('src:');
    expect(output).toContain('migrations-templates/');
    expect(output).toContain('\u2192');
    expect(output).toContain('dest:');
    expect(output).toContain('migrations/');
  });

  it('renders database connection status - connected', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'build',
      version: '0.4.7',
      dbConnected: true,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('db:');
    expect(output).toContain('\u25cf');
    expect(output).toContain('connected');
  });

  it('renders database connection status - disconnected', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'build',
      version: '0.4.7',
      dbConnected: false,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('disconnected');
  });

  it('renders last build time when provided', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'build',
      version: '0.4.7',
      lastBuild: new Date('2024-12-27T10:00:00Z'),
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('last:');
    expect(output).toContain('2h ago');
  });

  it('renders template counts', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'build',
      version: '0.4.7',
      templateCount: 12,
      wipCount: 2,
      needsBuildCount: 3,
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('12');
    expect(output).toContain('templates');
    expect(output).toContain('2 WIP');
    expect(output).toContain('3 needs build');
  });

  it('renders separator lines', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'build',
      version: '0.4.7',
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('\u2500\u2500\u2500');
  });

  it('omits optional sections when not provided', async () => {
    const { renderHeader } = await import('./header.js');
    renderHeader({
      subtitle: 'watch',
      version: '0.4.7',
    });

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('[srtd]');
    expect(output).toContain('watch');
    // Should not contain db status if not provided
    expect(output).not.toContain('db:');
  });
});
