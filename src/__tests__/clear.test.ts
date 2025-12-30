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
    config: {
      templateDir: 'templates',
      migrationDir: 'migrations',
      wipIndicator: '.wip',
      buildLog: '.buildlog.json',
      localBuildLog: '.buildlog.local.json',
    },
    warnings: [],
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

    await clearCommand.parseAsync(['node', 'test', '--local']);

    // Verify no Commander parse errors (they go to stderr)
    spies.assertNoStderr();
    expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('local');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('clears shared build logs with --shared flag', async () => {
    mockOrchestrator.clearBuildLogs.mockClear();

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', '--shared']);

    spies.assertNoStderr();
    expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('shared');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('resets config with --reset flag', async () => {
    mockOrchestrator.clearBuildLogs.mockClear();

    const { clearCommand } = await import('../commands/clear.js');
    const { resetConfig } = await import('../utils/config.js');

    await clearCommand.parseAsync(['node', 'test', '--reset']);

    spies.assertNoStderr();
    expect(resetConfig).toHaveBeenCalledWith('/test/project');
    expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('both');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles errors gracefully', async () => {
    mockOrchestrator.clearBuildLogs.mockRejectedValueOnce(new Error('Permission denied'));

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', '--local']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error in non-TTY mode without flags', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test']);

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

    await clearCommand.parseAsync(['node', 'test']);

    spies.assertNoStderr();
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

    await clearCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(0);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('handles project root errors gracefully', async () => {
    const { findProjectRoot } = await import('../utils/findProjectRoot.js');
    vi.mocked(findProjectRoot).mockRejectedValue(new Error('Not in a project'));

    const { clearCommand } = await import('../commands/clear.js');

    await clearCommand.parseAsync(['node', 'test', '--local']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
    const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Error');
  });

  describe('JSON output mode', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      // Reset findProjectRoot mock to default (previous test may have set it to reject)
      const { findProjectRoot } = await import('../utils/findProjectRoot.js');
      vi.mocked(findProjectRoot).mockResolvedValue('/test/project');
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('supports --json option', async () => {
      const { clearCommand } = await import('../commands/clear.js');
      const jsonOption = clearCommand.options.find(opt => opt.long === '--json');
      expect(jsonOption).toBeDefined();
    });

    it('outputs JSON when --json flag is provided with --local', async () => {
      mockOrchestrator.clearBuildLogs.mockClear();

      const { clearCommand } = await import('../commands/clear.js');

      await clearCommand.parseAsync(['node', 'test', '--json', '--local']);

      spies.assertNoStderr();
      expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('local');
      expect(spies.exitSpy).toHaveBeenCalledWith(0);

      const jsonOutput = stdoutSpy.mock.calls.map(call => call[0]).join('');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe('clear');
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.cleared).toBe(true);
    });

    it('outputs JSON when --json flag is provided with --shared', async () => {
      mockOrchestrator.clearBuildLogs.mockClear();

      const { clearCommand } = await import('../commands/clear.js');

      await clearCommand.parseAsync(['node', 'test', '--json', '--shared']);

      spies.assertNoStderr();
      expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('shared');
      expect(spies.exitSpy).toHaveBeenCalledWith(0);

      const jsonOutput = stdoutSpy.mock.calls.map(call => call[0]).join('');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe('clear');
      expect(parsed.cleared).toBe(true);
    });

    it('outputs JSON when --json flag is provided with --reset', async () => {
      mockOrchestrator.clearBuildLogs.mockClear();

      const { clearCommand } = await import('../commands/clear.js');

      await clearCommand.parseAsync(['node', 'test', '--json', '--reset']);

      spies.assertNoStderr();
      expect(mockOrchestrator.clearBuildLogs).toHaveBeenCalledWith('both');
      expect(spies.exitSpy).toHaveBeenCalledWith(0);

      const jsonOutput = stdoutSpy.mock.calls.map(call => call[0]).join('');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe('clear');
      expect(parsed.cleared).toBe(true);
    });

    it('skips branding in JSON mode', async () => {
      const { renderBranding } = await import('../ui/index.js');

      const { clearCommand } = await import('../commands/clear.js');

      await clearCommand.parseAsync(['node', 'test', '--json', '--local']);

      expect(renderBranding).not.toHaveBeenCalled();
    });

    it('outputs JSON error on failure', async () => {
      mockOrchestrator.clearBuildLogs.mockRejectedValueOnce(new Error('Permission denied'));

      const { clearCommand } = await import('../commands/clear.js');

      await clearCommand.parseAsync(['node', 'test', '--json', '--local']);

      expect(spies.exitSpy).toHaveBeenCalledWith(1);

      const jsonOutput = stdoutSpy.mock.calls.map(call => call[0]).join('');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Permission denied');
    });

    it('requires --local, --shared, or --reset flag in JSON mode', async () => {
      const { clearCommand } = await import('../commands/clear.js');

      await clearCommand.parseAsync(['node', 'test', '--json']);

      expect(spies.exitSpy).toHaveBeenCalledWith(1);

      const jsonOutput = stdoutSpy.mock.calls.map(call => call[0]).join('');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });
  });
});
