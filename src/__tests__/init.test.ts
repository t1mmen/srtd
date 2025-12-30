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
  saveConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/fileExists.js', () => ({
  fileExists: vi.fn().mockResolvedValue(false),
}));

vi.mock('../utils/ensureDirectories.js', () => ({
  ensureDirectories: vi.fn().mockResolvedValue({
    templateDir: true,
    migrationDir: true,
  }),
}));

vi.mock('../utils/createEmptyBuildLog.js', () => ({
  createEmptyBuildLog: vi.fn().mockResolvedValue(true),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Init Command', () => {
  let spies: ReturnType<typeof setupCommandTestSpies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    spies = setupCommandTestSpies();
  });

  afterEach(() => {
    spies.cleanup();
  });

  it('exports initCommand as a Commander command', async () => {
    const { initCommand } = await import('../commands/init.js');
    expect(initCommand).toBeInstanceOf(Command);
    expect(initCommand.name()).toBe('init');
  });

  it('has correct description', async () => {
    const { initCommand } = await import('../commands/init.js');
    expect(initCommand.description()).toBe('Initialize srtd in the current project');
  });

  it('creates config and directories on success', async () => {
    const { initCommand } = await import('../commands/init.js');
    const { saveConfig } = await import('../utils/config.js');
    const { ensureDirectories } = await import('../utils/ensureDirectories.js');
    const { createEmptyBuildLog } = await import('../utils/createEmptyBuildLog.js');

    await initCommand.parseAsync(['node', 'test']);

    spies.assertNoStderr();
    expect(saveConfig).toHaveBeenCalled();
    expect(ensureDirectories).toHaveBeenCalled();
    expect(createEmptyBuildLog).toHaveBeenCalled();
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles existing config gracefully', async () => {
    const { fileExists } = await import('../utils/fileExists.js');
    vi.mocked(fileExists).mockResolvedValue(true);

    const { initCommand } = await import('../commands/init.js');
    const { saveConfig } = await import('../utils/config.js');

    await initCommand.parseAsync(['node', 'test']);

    spies.assertNoStderr();
    // Should not call saveConfig if config already exists
    expect(saveConfig).not.toHaveBeenCalled();
    expect(spies.exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles errors gracefully', async () => {
    const { ensureDirectories } = await import('../utils/ensureDirectories.js');
    vi.mocked(ensureDirectories).mockRejectedValue(new Error('Permission denied'));

    const { initCommand } = await import('../commands/init.js');

    await initCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  describe('JSON output mode', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      // Reset mocks to default
      const { ensureDirectories } = await import('../utils/ensureDirectories.js');
      vi.mocked(ensureDirectories).mockResolvedValue({
        templateDir: true,
        migrationDir: true,
      });
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('supports --json option', async () => {
      const { initCommand } = await import('../commands/init.js');
      const jsonOption = initCommand.options.find(opt => opt.long === '--json');
      expect(jsonOption).toBeDefined();
    });

    it('outputs JSON when --json flag is provided', async () => {
      const { initCommand } = await import('../commands/init.js');

      await initCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      expect(spies.exitSpy).toHaveBeenCalledWith(0);

      const jsonOutput = stdoutSpy.mock.calls.map(call => call[0]).join('');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe('init');
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.config).toBeDefined();
      expect(parsed.configPath).toBe('srtd.config.json');
    });

    it('skips branding in JSON mode', async () => {
      const { renderBranding } = await import('../ui/index.js');

      const { initCommand } = await import('../commands/init.js');

      await initCommand.parseAsync(['node', 'test', '--json']);

      expect(renderBranding).not.toHaveBeenCalled();
    });

    it('outputs JSON error on failure', async () => {
      const { ensureDirectories } = await import('../utils/ensureDirectories.js');
      vi.mocked(ensureDirectories).mockRejectedValue(new Error('Permission denied'));

      const { initCommand } = await import('../commands/init.js');

      await initCommand.parseAsync(['node', 'test', '--json']);

      expect(spies.exitSpy).toHaveBeenCalledWith(1);

      const jsonOutput = stdoutSpy.mock.calls.map(call => call[0]).join('');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Permission denied');
    });

    it('suppresses console output in JSON mode', async () => {
      const { initCommand } = await import('../commands/init.js');

      await initCommand.parseAsync(['node', 'test', '--json']);

      spies.assertNoStderr();
      // console.log should not be called for regular messages
      const output = spies.consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).not.toContain('Initialization complete');
    });
  });
});
