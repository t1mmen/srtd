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
}));

vi.mock('glob', () => ({
  glob: vi.fn().mockResolvedValue([]),
}));

const mockOrchestrator = {
  promoteTemplate: vi
    .fn()
    .mockImplementation((path: string) => Promise.resolve(path.replace('.wip', ''))),
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

describe('Promote Command', () => {
  let spies: ReturnType<typeof setupCommandTestSpies>;

  beforeEach(() => {
    vi.clearAllMocks();
    // NOTE: Don't use vi.resetModules() here - it breaks glob mock sharing
    spies = setupCommandTestSpies();
  });

  afterEach(() => {
    spies.cleanup();
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

    // Note: Don't include 'promote' in args - it's already the subcommand being tested
    await promoteCommand.parseAsync(['node', 'test', 'test.wip.sql']);

    spies.assertNoStderr();
    expect(mockOrchestrator.promoteTemplate).toHaveBeenCalled();
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with error when template not found', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'nonexistent.wip.sql']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error for non-WIP template', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.sql']);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'test.sql']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error in non-TTY mode without arguments', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('handles file rename errors', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    // Mock Orchestrator to throw an error
    mockOrchestrator.promoteTemplate.mockRejectedValueOnce(new Error('Permission denied'));

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'test.wip.sql']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);

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

    spies.assertNoStderr();
    const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('No WIP templates found');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('updates build log when promoting tracked template', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue(['test.wip.sql']);

    // Clear previous calls
    mockOrchestrator.promoteTemplate.mockClear();

    const { promoteCommand } = await import('../commands/promote.js');

    await promoteCommand.parseAsync(['node', 'test', 'test.wip.sql']);

    spies.assertNoStderr();
    // Orchestrator now handles build log updates internally
    expect(mockOrchestrator.promoteTemplate).toHaveBeenCalled();
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
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

    expect(spies.exitSpy).toHaveBeenCalledWith(0);

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

    spies.assertNoStderr();
    expect(select).toHaveBeenCalled();
    expect(mockOrchestrator.promoteTemplate).toHaveBeenCalled();
    expect(spies.exitSpy).toHaveBeenCalledWith(0);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });
});
