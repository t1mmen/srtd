import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockFindProjectRoot,
  createMockUiModule,
  setupCommandTestSpies,
} from './helpers/testUtils.js';

// Mock all dependencies before importing the command
vi.mock('../ui/index.js', () => createMockUiModule());
vi.mock('../utils/findProjectRoot.js', () => createMockFindProjectRoot());

vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn().mockResolvedValue({
    templateDir: 'templates',
    migrationDir: 'migrations',
    wipIndicator: '.wip',
    buildLog: '.buildlog.json',
    localBuildLog: '.buildlog.local.json',
  }),
  resetConfig: vi.fn().mockResolvedValue(undefined),
}));

const mockOrchestrator = {
  clearBuildLogs: vi.fn().mockResolvedValue(undefined),
  [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
  [Symbol.dispose]: vi.fn(),
};

vi.mock('../services/Orchestrator.js', () => ({
  Orchestrator: {
    create: vi.fn().mockResolvedValue(mockOrchestrator),
  },
}));

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}));

describe('Clear Command', () => {
  let spies: ReturnType<typeof setupCommandTestSpies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    spies = setupCommandTestSpies();
  });

  afterEach(() => {
    spies.cleanup();
  });

  it('exports clearCommand as a Commander command', async () => {
    const { clearCommand } = await import('../commands/clear.js');
    expect(clearCommand).toBeInstanceOf(Command);
    expect(clearCommand.name()).toBe('clear');
  });

  it('has correct description', async () => {
    const { clearCommand } = await import('../commands/clear.js');
    expect(clearCommand.description()).toBe('Clear build logs or reset configuration');
  });

  it('supports --local option', async () => {
    const { clearCommand } = await import('../commands/clear.js');
    const localOption = clearCommand.options.find(opt => opt.long === '--local');
    expect(localOption).toBeDefined();
  });

  it('supports --shared option', async () => {
    const { clearCommand } = await import('../commands/clear.js');
    const sharedOption = clearCommand.options.find(opt => opt.long === '--shared');
    expect(sharedOption).toBeDefined();
  });

  it('supports --reset option', async () => {
    const { clearCommand } = await import('../commands/clear.js');
    const resetOption = clearCommand.options.find(opt => opt.long === '--reset');
    expect(resetOption).toBeDefined();
  });

  it('clears local build logs with --local flag', async () => {
    mockOrchestrator.clearBuildLogs.mockClear();

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', 'clear', '--local']);

    expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('local');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('clears shared build logs with --shared flag', async () => {
    mockOrchestrator.clearBuildLogs.mockClear();

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', 'clear', '--shared']);

    expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('shared');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('resets config with --reset flag', async () => {
    mockOrchestrator.clearBuildLogs.mockClear();

    const { clearCommand } = await import('../commands/clear.js');
    const { resetConfig } = await import('../utils/config.js');

    await clearCommand.parseAsync(['node', 'test', 'clear', '--reset']);

    expect(resetConfig).toHaveBeenCalledWith('/test/project');
    expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('both');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles errors gracefully', async () => {
    mockOrchestrator.clearBuildLogs.mockRejectedValueOnce(new Error('Permission denied'));

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', 'clear', '--local']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error in non-TTY mode without flags', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', 'clear']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
    const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Interactive mode requires a TTY');

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('allows interactive selection in TTY mode', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

    mockOrchestrator.clearBuildLogs.mockClear();

    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('local');

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', 'clear']);

    expect(select).toHaveBeenCalled();
    expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('local');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('handles interactive Ctrl+C gracefully', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

    const { select } = await import('@inquirer/prompts');
    const exitError = new Error('User cancelled');
    exitError.name = 'ExitPromptError';
    vi.mocked(select).mockRejectedValue(exitError);

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', 'clear']);

    expect(spies.exitSpy).toHaveBeenCalledWith(0);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('handles project root errors gracefully', async () => {
    const { findProjectRoot } = await import('../utils/findProjectRoot.js');
    vi.mocked(findProjectRoot).mockRejectedValue(new Error('Not in a project'));

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', 'clear', '--local']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
    const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Error');
  });
});
