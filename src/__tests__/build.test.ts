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
    text: '',
  })),
  renderResults: vi.fn(),
}));

vi.mock('../utils/findProjectRoot.js', () => ({
  findProjectRoot: vi.fn().mockResolvedValue('/test/project'),
}));

vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn().mockResolvedValue({
    templateDir: 'templates',
    migrationDir: 'migrations',
    buildLog: '.buildlog.json',
    localBuildLog: '.buildlog.local.json',
  }),
}));

const mockOrchestrator = {
  build: vi.fn(),
  apply: vi.fn(),
  [Symbol.dispose]: vi.fn(),
};

vi.mock('../services/Orchestrator.js', () => ({
  Orchestrator: {
    create: vi.fn().mockResolvedValue(mockOrchestrator),
  },
}));

describe('Build Command', () => {
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

  it('exports buildCommand as a Commander command', async () => {
    const { buildCommand } = await import('../commands/build.js');
    expect(buildCommand).toBeInstanceOf(Command);
    expect(buildCommand.name()).toBe('build');
  });

  it('has correct description', async () => {
    const { buildCommand } = await import('../commands/build.js');
    expect(buildCommand.description()).toBe('Build migrations from templates');
  });

  it('supports --force option', async () => {
    const { buildCommand } = await import('../commands/build.js');
    const forceOption = buildCommand.options.find(opt => opt.long === '--force');
    expect(forceOption).toBeDefined();
    expect(forceOption?.short).toBe('-f');
  });

  it('supports --apply option', async () => {
    const { buildCommand } = await import('../commands/build.js');
    const applyOption = buildCommand.options.find(opt => opt.long === '--apply');
    expect(applyOption).toBeDefined();
    expect(applyOption?.short).toBe('-a');
  });

  it('supports --bundle option', async () => {
    const { buildCommand } = await import('../commands/build.js');
    const bundleOption = buildCommand.options.find(opt => opt.long === '--bundle');
    expect(bundleOption).toBeDefined();
    expect(bundleOption?.short).toBe('-b');
  });

  it('executes build with successful result', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: ['migration1.sql', 'migration2.sql'],
      skipped: [],
      errors: [],
    });

    await buildCommand.parseAsync(['node', 'test', 'build']);

    expect(mockOrchestrator.build).toHaveBeenCalledWith({
      force: undefined,
      bundle: undefined,
      silent: true,
    });
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('executes build with --force flag', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: ['migration1.sql'],
      skipped: [],
      errors: [],
    });

    await buildCommand.parseAsync(['node', 'test', 'build', '--force']);

    expect(mockOrchestrator.build).toHaveBeenCalledWith({
      force: true,
      bundle: undefined,
      silent: true,
    });
  });

  it('executes build with --bundle flag', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: ['bundle.sql'],
      skipped: [],
      errors: [],
    });

    await buildCommand.parseAsync(['node', 'test', 'build', '--bundle']);

    expect(mockOrchestrator.build).toHaveBeenCalledWith({
      force: undefined,
      bundle: true,
      silent: true,
    });
  });

  it('executes build with --apply flag (build + apply)', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: ['migration1.sql'],
      skipped: [],
      errors: [],
    });

    mockOrchestrator.apply.mockResolvedValue({
      applied: ['migration1.sql'],
      built: [],
      skipped: [],
      errors: [],
    });

    await buildCommand.parseAsync(['node', 'test', 'build', '--apply']);

    expect(mockOrchestrator.build).toHaveBeenCalled();
    expect(mockOrchestrator.apply).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with code 1 when build has errors', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: [],
      skipped: [],
      errors: [{ templateName: 'bad.sql', error: 'Template parse error' }],
    });

    await buildCommand.parseAsync(['node', 'test', 'build']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles thrown errors gracefully', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockRejectedValue(new Error('File system error'));

    await buildCommand.parseAsync(['node', 'test', 'build']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
