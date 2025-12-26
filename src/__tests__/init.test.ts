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
  })),
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
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
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

    await initCommand.parseAsync(['node', 'test', 'init']);

    expect(saveConfig).toHaveBeenCalled();
    expect(ensureDirectories).toHaveBeenCalled();
    expect(createEmptyBuildLog).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles existing config gracefully', async () => {
    const { fileExists } = await import('../utils/fileExists.js');
    vi.mocked(fileExists).mockResolvedValue(true);

    const { initCommand } = await import('../commands/init.js');
    const { saveConfig } = await import('../utils/config.js');

    await initCommand.parseAsync(['node', 'test', 'init']);

    // Should not call saveConfig if config already exists
    expect(saveConfig).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles errors gracefully', async () => {
    const { ensureDirectories } = await import('../utils/ensureDirectories.js');
    vi.mocked(ensureDirectories).mockRejectedValue(new Error('Permission denied'));

    const { initCommand } = await import('../commands/init.js');

    await initCommand.parseAsync(['node', 'test', 'init']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
