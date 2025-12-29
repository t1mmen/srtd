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

vi.mock('../ui/displayWarnings.js', () => ({
  displayValidationWarnings: vi.fn(),
}));

const mockOrchestrator = {
  build: vi.fn(),
  apply: vi.fn(),
  getValidationWarnings: vi.fn().mockReturnValue([]),
  getTemplateInfo: vi
    .fn()
    .mockReturnValue({ template: '', migrationFile: undefined, lastDate: undefined }),
  [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
  [Symbol.dispose]: vi.fn(),
};

vi.mock('../services/Orchestrator.js', () => ({
  Orchestrator: {
    create: vi.fn().mockResolvedValue(mockOrchestrator),
  },
}));

describe('Build Command', () => {
  let spies: ReturnType<typeof setupCommandTestSpies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    spies = setupCommandTestSpies();
  });

  afterEach(() => {
    spies.cleanup();
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

    await buildCommand.parseAsync(['node', 'test']);

    spies.assertNoStderr();
    expect(mockOrchestrator.build).toHaveBeenCalledWith({
      force: undefined,
      bundle: undefined,
      silent: true,
      respectDependencies: true,
    });
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('executes build with --force flag', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: ['migration1.sql'],
      skipped: [],
      errors: [],
    });

    await buildCommand.parseAsync(['node', 'test', '--force']);

    spies.assertNoStderr();
    expect(mockOrchestrator.build).toHaveBeenCalledWith({
      force: true,
      bundle: undefined,
      silent: true,
      respectDependencies: true,
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

    await buildCommand.parseAsync(['node', 'test', '--bundle']);

    spies.assertNoStderr();
    expect(mockOrchestrator.build).toHaveBeenCalledWith({
      force: undefined,
      bundle: true,
      silent: true,
      respectDependencies: true,
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

    await buildCommand.parseAsync(['node', 'test', '--apply']);

    spies.assertNoStderr();
    expect(mockOrchestrator.build).toHaveBeenCalled();
    expect(mockOrchestrator.apply).toHaveBeenCalled();
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with code 1 when build has errors', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: [],
      skipped: [],
      errors: [{ file: 'bad.sql', templateName: 'bad.sql', error: 'Template parse error' }],
    });

    await buildCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles thrown errors gracefully', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockRejectedValue(new Error('File system error'));

    await buildCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('disposes orchestrator before exiting', async () => {
    const { buildCommand } = await import('../commands/build.js');

    mockOrchestrator.build.mockResolvedValue({
      applied: [],
      built: ['migration1.sql'],
      skipped: [],
      errors: [],
    });

    await buildCommand.parseAsync(['node', 'test']);

    // Verify async dispose was called (await using triggers Symbol.asyncDispose)
    expect(mockOrchestrator[Symbol.asyncDispose]).toHaveBeenCalled();
  });

  describe('new UI components', () => {
    it('uses renderBranding with subtitle', async () => {
      const uiModule = await import('../ui/index.js');
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql'],
        skipped: [],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      expect(uiModule.renderBranding).toHaveBeenCalledWith({ subtitle: 'Build' });
    });

    it('uses renderResultsTable for displaying results', async () => {
      const uiModule = await import('../ui/index.js');
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql', 'migration2.sql'],
        skipped: ['unchanged.sql'],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      // Order: unchanged/skipped first, then built (newest at bottom, log-style)
      expect(uiModule.renderResultsTable).toHaveBeenCalledWith({
        results: [
          {
            template: 'unchanged.sql',
            status: 'unchanged',
            target: undefined,
            timestamp: undefined,
          },
          { template: 'migration1.sql', status: 'success', target: undefined },
          { template: 'migration2.sql', status: 'success', target: undefined },
        ],
        context: { command: 'build', forced: undefined },
      });
      expect(uiModule.renderResults).not.toHaveBeenCalled();
    });

    it('includes applied templates in results when --apply flag is used', async () => {
      const uiModule = await import('../ui/index.js');
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
        skipped: ['unchanged.sql'],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test', '--apply']);

      spies.assertNoStderr();
      // Order: unchanged/skipped first, then built (newest at bottom, log-style)
      expect(uiModule.renderResultsTable).toHaveBeenCalledWith({
        results: [
          {
            template: 'unchanged.sql',
            status: 'unchanged',
            target: undefined,
            timestamp: undefined,
          },
          { template: 'migration1.sql', status: 'success', target: undefined },
        ],
        context: { command: 'build', forced: undefined },
      });
    });

    it('uses renderErrorDisplay for errors', async () => {
      const uiModule = await import('../ui/index.js');
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: [],
        skipped: [],
        errors: [{ file: 'bad.sql', templateName: 'bad.sql', error: 'syntax error at line 5' }],
      });

      await buildCommand.parseAsync(['node', 'test']);

      expect(uiModule.renderErrorDisplay).toHaveBeenCalledWith({
        errors: [{ template: 'bad.sql', message: 'syntax error at line 5' }],
      });
    });

    it('does not call renderErrorDisplay when there are no errors', async () => {
      const uiModule = await import('../ui/index.js');
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql'],
        skipped: [],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      expect(uiModule.renderErrorDisplay).not.toHaveBeenCalled();
    });
  });
});
