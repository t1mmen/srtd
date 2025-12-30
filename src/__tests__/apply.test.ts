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

describe('Apply Command', () => {
  let spies: ReturnType<typeof setupCommandTestSpies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    spies = setupCommandTestSpies();
  });

  afterEach(() => {
    spies.cleanup();
  });

  it('exports applyCommand as a Commander command', async () => {
    const { applyCommand } = await import('../commands/apply.js');
    expect(applyCommand).toBeInstanceOf(Command);
    expect(applyCommand.name()).toBe('apply');
  });

  it('has correct description', async () => {
    const { applyCommand } = await import('../commands/apply.js');
    expect(applyCommand.description()).toBe('Apply built migrations to the database');
  });

  it('supports --force option', async () => {
    const { applyCommand } = await import('../commands/apply.js');
    const forceOption = applyCommand.options.find(opt => opt.long === '--force');
    expect(forceOption).toBeDefined();
    expect(forceOption?.short).toBe('-f');
  });

  it('executes apply with successful result', async () => {
    const { applyCommand } = await import('../commands/apply.js');

    mockOrchestrator.apply.mockResolvedValue({
      applied: ['migration1.sql', 'migration2.sql'],
      built: [],
      skipped: [],
      errors: [],
    });

    await applyCommand.parseAsync(['node', 'test']);

    spies.assertNoStderr();
    expect(mockOrchestrator.apply).toHaveBeenCalledWith({
      force: undefined,
      silent: true,
      respectDependencies: true,
    });
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('executes apply with --force flag', async () => {
    const { applyCommand } = await import('../commands/apply.js');

    mockOrchestrator.apply.mockResolvedValue({
      applied: ['migration1.sql'],
      built: [],
      skipped: [],
      errors: [],
    });

    await applyCommand.parseAsync(['node', 'test', '--force']);

    spies.assertNoStderr();
    expect(mockOrchestrator.apply).toHaveBeenCalledWith({
      force: true,
      silent: true,
      respectDependencies: true,
    });
  });

  it('exits with code 1 when there are errors', async () => {
    const { applyCommand } = await import('../commands/apply.js');

    mockOrchestrator.apply.mockResolvedValue({
      applied: [],
      built: [],
      skipped: [],
      errors: [{ file: 'bad.sql', templateName: 'bad.sql', error: 'Syntax error' }],
    });

    await applyCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles thrown errors gracefully', async () => {
    const { applyCommand } = await import('../commands/apply.js');

    mockOrchestrator.apply.mockRejectedValue(new Error('Database connection failed'));

    await applyCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  describe('new UI components', () => {
    it('uses renderBranding with subtitle', async () => {
      const uiModule = await import('../ui/index.js');
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql'],
        built: [],
        skipped: [],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      expect(uiModule.renderBranding).toHaveBeenCalledWith({ subtitle: 'Apply' });
    });

    it('uses output() for displaying results', async () => {
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql', 'migration2.sql'],
        built: [],
        skipped: ['unchanged.sql'],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      // Log-style ordering: unchanged (old) at top, applied (new) at bottom
      expect(mockOutput).toHaveBeenCalledWith({
        results: [
          { template: 'unchanged.sql', status: 'unchanged', timestamp: undefined },
          { template: 'migration1.sql', status: 'success' },
          { template: 'migration2.sql', status: 'success' },
        ],
        context: { command: 'apply', forced: undefined, json: undefined },
      });
    });

    it('uses renderErrorDisplay for errors', async () => {
      const uiModule = await import('../ui/index.js');
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: [],
        built: [],
        skipped: [],
        errors: [{ file: 'bad.sql', templateName: 'bad.sql', error: 'syntax error at line 5' }],
      });

      await applyCommand.parseAsync(['node', 'test']);

      expect(uiModule.renderErrorDisplay).toHaveBeenCalledWith({
        errors: [{ template: 'bad.sql', message: 'syntax error at line 5' }],
      });
    });

    it('does not call renderErrorDisplay when there are no errors', async () => {
      const uiModule = await import('../ui/index.js');
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql'],
        built: [],
        skipped: [],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      expect(uiModule.renderErrorDisplay).not.toHaveBeenCalled();
    });
  });

  describe('--json flag', () => {
    it('supports --json option', async () => {
      const { applyCommand } = await import('../commands/apply.js');
      const jsonOption = applyCommand.options.find(opt => opt.long === '--json');
      expect(jsonOption).toBeDefined();
    });

    it('uses output() with json context when --json flag is provided', async () => {
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql'],
        built: [],
        skipped: ['unchanged.sql'],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      expect(mockOutput).toHaveBeenCalledWith({
        results: expect.arrayContaining([
          expect.objectContaining({ template: 'unchanged.sql', status: 'unchanged' }),
          expect.objectContaining({ template: 'migration1.sql', status: 'success' }),
        ]),
        context: { command: 'apply', forced: undefined, json: true },
      });
    });

    it('skips branding when --json flag is provided', async () => {
      const uiModule = await import('../ui/index.js');
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql'],
        built: [],
        skipped: [],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      expect(uiModule.renderBranding).not.toHaveBeenCalled();
    });

    it('skips renderErrorDisplay when --json flag is provided even with errors', async () => {
      const uiModule = await import('../ui/index.js');
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: [],
        built: [],
        skipped: [],
        errors: [{ file: 'bad.sql', templateName: 'bad.sql', error: 'syntax error' }],
      });

      await applyCommand.parseAsync(['node', 'test', '--json']);

      // Errors are included in JSON output, not via renderErrorDisplay
      expect(uiModule.renderErrorDisplay).not.toHaveBeenCalled();
      expect(spies.exitSpy).toHaveBeenCalledWith(1);
    });

    it('skips displayValidationWarnings when --json flag is provided', async () => {
      const displayWarnings = await import('../ui/displayWarnings.js');
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.getValidationWarnings.mockReturnValue([
        { type: 'warning', message: 'Some warning' },
      ]);
      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql'],
        built: [],
        skipped: [],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      expect(displayWarnings.displayValidationWarnings).not.toHaveBeenCalled();
    });

    it('uses output() with json: undefined when --json is not provided', async () => {
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql'],
        built: [],
        skipped: [],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      // When not in JSON mode, output() is called with json: undefined
      expect(mockOutput).toHaveBeenCalledWith({
        results: expect.any(Array),
        context: { command: 'apply', forced: undefined, json: undefined },
      });
    });
  });
});
