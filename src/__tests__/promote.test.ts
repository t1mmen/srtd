import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies before importing the command
vi.mock('../ui/index.js', () => ({
  renderBranding: vi.fn().mockResolvedValue(undefined),
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../utils/findProjectRoot.js', () => ({
  findProjectRoot: vi.fn().mockResolvedValue('/test/project'),
}));

vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn().mockResolvedValue({
    templateDir: 'templates',
    migrationDir: 'migrations',
    wipIndicator: '.wip',
    buildLog: '.buildlog.json',
    localBuildLog: '.buildlog.local.json',
  }),
}));

vi.mock('glob', () => ({
  glob: vi.fn().mockResolvedValue([]),
}));

const mockOrchestrator = {
  promoteTemplate: vi
    .fn()
    .mockImplementation((path: string) => Promise.resolve(path.replace('.wip', ''))),
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

describe('Promote Command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('exports promoteCommand as a Commander command', async () => {
    const { promoteCommand } = await import('../commands/promote.js');
    expect(promoteCommand).toBeInstanceOf(Command);
    expect(promoteCommand.name()).toBe('promote');
  });

  it('has correct description', async () => {
    const { promoteCommand } = await import('../commands/promote.js');
    expect(promoteCommand.description()).toBe(
      'Promote a WIP template by removing the WIP indicator from its filename'
    );
  });

  it('accepts optional template argument', async () => {
    const { promoteCommand } = await import('../commands/promote.js');
    const args = promoteCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('template');
    expect(args[0].required).toBe(false);
  });

  it('promotes a WIP template with argument', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    // Clear previous calls
    mockOrchestrator.promoteTemplate.mockClear();

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'promote', 'test.wip.sql']);

    expect(mockOrchestrator.promoteTemplate).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with error when template not found', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'promote', 'nonexistent.wip.sql']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error for non-WIP template', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.sql']);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'promote', 'test.sql']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error in non-TTY mode without arguments', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'promote']);

    expect(exitSpy).toHaveBeenCalledWith(1);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('handles file rename errors', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    // Mock Orchestrator to throw an error
    mockOrchestrator.promoteTemplate.mockRejectedValueOnce(new Error('Permission denied'));

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'promote', 'test.wip.sql']);

    expect(exitSpy).toHaveBeenCalledWith(1);

    // Reset for other tests
    mockOrchestrator.promoteTemplate.mockImplementation((path: string) =>
      Promise.resolve(path.replace('.wip', ''))
    );
  });

  it('shows no WIP templates message when none exist', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test']);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('No WIP templates found');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('updates build log when promoting tracked template', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    // Clear previous calls
    mockOrchestrator.promoteTemplate.mockClear();

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'test.wip.sql']);

    // Orchestrator now handles build log updates internally
    expect(mockOrchestrator.promoteTemplate).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles interactive selection with Ctrl+C', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    const { select } = await import('@inquirer/prompts');
    const exitError = new Error('User cancelled');
    exitError.name = 'ExitPromptError';
    vi.mocked(select).mockRejectedValue(exitError);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test']);

    expect(exitSpy).toHaveBeenCalledWith(0);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('allows interactive selection in TTY mode', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    // Clear previous calls
    mockOrchestrator.promoteTemplate.mockClear();

    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('/test/project/templates/test.wip.sql');

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test']);

    expect(select).toHaveBeenCalled();
    expect(mockOrchestrator.promoteTemplate).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });
});
