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

    it('uses renderResultsTable for displaying results', async () => {
      const uiModule = await import('../ui/index.js');
      const { applyCommand } = await import('../commands/apply.js');

      mockOrchestrator.apply.mockResolvedValue({
        applied: ['migration1.sql', 'migration2.sql'],
        built: [],
        skipped: ['unchanged.sql'],
        errors: [],
      });

      await applyCommand.parseAsync(['node', 'test']);

      spies.assertNoStderr();
      expect(uiModule.renderResultsTable).toHaveBeenCalledWith({
        rows: [
          { template: 'migration1.sql', status: 'applied' },
          { template: 'migration2.sql', status: 'applied' },
        ],
        unchanged: [{ template: 'unchanged.sql', lastDate: undefined, lastAction: 'applied' }],
        errorCount: 0,
      });
      expect(uiModule.renderResults).not.toHaveBeenCalled();
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
});
