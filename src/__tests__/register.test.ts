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
      buildLog: '.buildlog.json',
      localBuildLog: '.buildlog.local.json',
    },
    warnings: [],
  }),
}));

const mockOrchestrator = {
  findTemplates: vi.fn().mockResolvedValue([]),
  getTemplateStatusExternal: vi.fn(),
  registerTemplate: vi.fn().mockResolvedValue(undefined),
  [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
  [Symbol.dispose]: vi.fn(),
};

vi.mock('../services/Orchestrator.js', () => ({
  Orchestrator: {
    create: vi.fn().mockResolvedValue(mockOrchestrator),
  },
}));

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn().mockResolvedValue([]),
}));

describe('Register Command', () => {
  let spies: ReturnType<typeof setupCommandTestSpies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    spies = setupCommandTestSpies();
  });

  afterEach(() => {
    spies.cleanup();
  });

  it('exports registerCommand as a Commander command', async () => {
    const { registerCommand } = await import('../commands/register.js');
    expect(registerCommand).toBeInstanceOf(Command);
    expect(registerCommand.name()).toBe('register');
  });

  it('has correct description', async () => {
    const { registerCommand } = await import('../commands/register.js');
    expect(registerCommand.description()).toBe('Register templates to track them in the build log');
  });

  it('accepts optional templates argument', async () => {
    const { registerCommand } = await import('../commands/register.js');
    const args = registerCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('templates');
    expect(args[0].variadic).toBe(true);
  });

  it('registers templates with arguments', async () => {
    // Clear any previous calls from other tests
    mockOrchestrator.registerTemplate.mockClear();

    const { registerCommand } = await import('../commands/register.js');

    // When parsing a subcommand directly, don't include the command name
    await registerCommand.parseAsync(['node', 'test', 'template1.sql', 'template2.sql']);

    spies.assertNoStderr();
    expect(mockOrchestrator.registerTemplate).toHaveBeenCalledTimes(2);
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles registration errors', async () => {
    mockOrchestrator.registerTemplate.mockRejectedValue(new Error('File not found'));

    const { registerCommand } = await import('../commands/register.js');

    await registerCommand.parseAsync(['node', 'test', 'bad.sql']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);

    // Reset for other tests
    mockOrchestrator.registerTemplate.mockResolvedValue(undefined);
  });

  it('shows message when no templates found', async () => {
    // Mock orchestrator returns empty templates list
    mockOrchestrator.findTemplates.mockResolvedValue([]);
    mockOrchestrator.getTemplateStatusExternal.mockResolvedValue(undefined);

    const { registerCommand } = await import('../commands/register.js');

    // No template arguments - triggers interactive mode path
    await registerCommand.parseAsync(['node', 'test']);

    spies.assertNoStderr();
    const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('No templates found');
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('shows message when all templates are registered', async () => {
    // Set up a template that is already registered (has lastMigrationFile)
    mockOrchestrator.findTemplates.mockResolvedValue(['/test/project/templates/test.sql']);
    mockOrchestrator.getTemplateStatusExternal.mockResolvedValue({
      name: 'test',
      path: '/test/project/templates/test.sql',
      buildState: { lastMigrationFile: 'migration.sql', lastHash: 'abc123' },
    });

    const { registerCommand } = await import('../commands/register.js');

    // No template arguments - triggers interactive mode path
    await registerCommand.parseAsync(['node', 'test']);

    // The command exits with 0 when all templates are already registered
    const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
    spies.assertNoStderr();
    // The message says "All X template(s) are already registered."
    expect(output).toMatch(/already registered|No unregistered templates/);
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with error in non-TTY mode without arguments', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    mockOrchestrator.findTemplates.mockResolvedValue(['/test/project/templates/test.sql']);
    mockOrchestrator.getTemplateStatusExternal.mockResolvedValue({
      name: 'test',
      path: '/test/project/templates/test.sql',
      buildState: { lastMigrationFile: null },
    });

    const { registerCommand } = await import('../commands/register.js');

    // No template arguments - triggers interactive mode path (but non-TTY)
    await registerCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });
});
