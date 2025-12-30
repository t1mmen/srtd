import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockFindProjectRoot,
  createMockUiModule,
  setupCommandTestSpies,
} from './helpers/testUtils.js';

// Mock all dependencies before importing the command
vi.mock('../ui/index.js', () => createMockUiModule());

// Mock output module - need to track calls to output()
const mockOutput = vi.fn();
vi.mock('../output/index.js', () => ({
  output: mockOutput,
}));
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

    it('uses output() for displaying results', async () => {
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
      expect(mockOutput).toHaveBeenCalledWith({
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
        context: { command: 'build', forced: undefined, json: undefined },
      });
    });

    it('includes applied templates in results when --apply flag is used', async () => {
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
      expect(mockOutput).toHaveBeenCalledWith({
        results: [
          {
            template: 'unchanged.sql',
            status: 'unchanged',
            target: undefined,
            timestamp: undefined,
          },
          { template: 'migration1.sql', status: 'success', target: undefined },
        ],
        context: { command: 'build', forced: undefined, json: undefined },
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

  describe('--json flag', () => {
    it('supports --json option', async () => {
      const { buildCommand } = await import('../commands/build.js');
      const jsonOption = buildCommand.options.find(opt => opt.long === '--json');
      expect(jsonOption).toBeDefined();
    });

    it('uses output() with json context when --json flag is provided', async () => {
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql'],
        skipped: ['unchanged.sql'],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      expect(mockOutput).toHaveBeenCalledWith({
        results: expect.arrayContaining([
          expect.objectContaining({ template: 'unchanged.sql', status: 'unchanged' }),
          expect.objectContaining({ template: 'migration1.sql', status: 'success' }),
        ]),
        context: { command: 'build', forced: undefined, json: true },
      });
    });

    it('skips branding when --json flag is provided', async () => {
      const uiModule = await import('../ui/index.js');
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql'],
        skipped: [],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      expect(uiModule.renderBranding).not.toHaveBeenCalled();
    });

    it('skips renderErrorDisplay when --json flag is provided even with errors', async () => {
      const uiModule = await import('../ui/index.js');
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: [],
        skipped: [],
        errors: [{ file: 'bad.sql', templateName: 'bad.sql', error: 'syntax error' }],
      });

      await buildCommand.parseAsync(['node', 'test', '--json']);

      // Errors are included in JSON output, not via renderErrorDisplay
      expect(uiModule.renderErrorDisplay).not.toHaveBeenCalled();
      expect(spies.exitSpy).toHaveBeenCalledWith(1);
    });

    it('skips displayValidationWarnings when --json flag is provided', async () => {
      const displayWarnings = await import('../ui/displayWarnings.js');
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.getValidationWarnings.mockReturnValue([
        { type: 'warning', message: 'Some warning' },
      ]);
      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql'],
        skipped: [],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      expect(displayWarnings.displayValidationWarnings).not.toHaveBeenCalled();
    });

    it('uses output() with json: undefined when --json is not provided', async () => {
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql'],
        skipped: [],
        errors: [],
      });

      await buildCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      // When not in JSON mode, output() is called with json: undefined
      expect(mockOutput).toHaveBeenCalledWith({
        results: expect.any(Array),
        context: { command: 'build', forced: undefined, json: undefined },
      });
    });

    it('handles build+apply combo with JSON output', async () => {
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

      await buildCommand.parseAsync(['node', 'test', '--apply', '--json']);

      spies.assertNoStderr();
      // Both build and apply results should be in the JSON output
      expect(mockOutput).toHaveBeenCalledWith({
        results: expect.arrayContaining([
          expect.objectContaining({ template: 'unchanged.sql', status: 'unchanged' }),
          expect.objectContaining({ template: 'migration1.sql', status: 'success' }),
        ]),
        context: { command: 'build', forced: undefined, json: true },
      });
    });

    it('includes errors in JSON output when build+apply has errors', async () => {
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockResolvedValue({
        applied: [],
        built: ['migration1.sql'],
        skipped: [],
        errors: [],
      });

      mockOrchestrator.apply.mockResolvedValue({
        applied: [],
        built: [],
        skipped: [],
        errors: [{ file: 'bad.sql', templateName: 'bad.sql', error: 'apply error' }],
      });

      await buildCommand.parseAsync(['node', 'test', '--apply', '--json']);

      expect(mockOutput).toHaveBeenCalledWith({
        results: expect.arrayContaining([
          expect.objectContaining({ template: 'migration1.sql', status: 'success' }),
          expect.objectContaining({
            template: 'bad.sql',
            status: 'error',
            errorMessage: 'apply error',
          }),
        ]),
        context: { command: 'build', forced: undefined, json: true },
      });
      expect(spies.exitSpy).toHaveBeenCalledWith(1);
    });

    it('outputs JSON error when fatal error occurs with --json flag', async () => {
      const { buildCommand } = await import('../commands/build.js');

      // Capture stdout output
      const outputs: string[] = [];
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        if (typeof chunk === 'string') {
          outputs.push(chunk);
        }
        return true;
      });

      mockOrchestrator.build.mockRejectedValue(new Error('File system error'));

      await buildCommand.parseAsync(['node', 'test', '--json']);

      // Find JSON error output (includes space due to pretty-printing)
      const jsonOutputStr = outputs.find(o => o.includes('"success": false'));
      expect(jsonOutputStr).toBeDefined();

      const jsonOutput = JSON.parse(jsonOutputStr!);
      expect(jsonOutput).toMatchObject({
        success: false,
        command: 'build',
        error: 'File system error',
        results: [],
        summary: { total: 0, success: 0, error: 1, unchanged: 0, skipped: 0 },
      });
      expect(jsonOutput.timestamp).toBeDefined();

      expect(spies.exitSpy).toHaveBeenCalledWith(1);
      stdoutSpy.mockRestore();
    });

    it('outputs human-readable error when fatal error occurs without --json flag', async () => {
      const { buildCommand } = await import('../commands/build.js');

      mockOrchestrator.build.mockRejectedValue(new Error('File system error'));

      await buildCommand.parseAsync(['node', 'test']);

      // Should use console.log with chalk.red for human-readable error
      const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Error building templates');
      expect(output).toContain('File system error');
      expect(spies.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
