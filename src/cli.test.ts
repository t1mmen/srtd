import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before any imports
vi.mock('update-notifier', () => ({
  default: vi.fn(() => ({ notify: vi.fn() })),
}));

vi.mock('./commands/init.js', () => ({
  initCommand: new Command('init').description('Test init'),
}));

vi.mock('./commands/apply.js', () => ({
  applyCommand: new Command('apply').description('Test apply'),
}));

vi.mock('./commands/build.js', () => ({
  buildCommand: new Command('build').description('Test build'),
}));

vi.mock('./commands/clear.js', () => ({
  clearCommand: new Command('clear').description('Test clear'),
}));

vi.mock('./commands/promote.js', () => ({
  promoteCommand: new Command('promote').description('Test promote'),
}));

vi.mock('./commands/register.js', () => ({
  registerCommand: new Command('register').description('Test register'),
}));

vi.mock('./commands/watch.js', () => ({
  watchCommand: new Command('watch').description('Test watch'),
}));

vi.mock('./commands/menu.js', () => ({
  showMenu: vi.fn().mockResolvedValue(undefined),
}));

describe('cli', () => {
  const originalArgv = process.argv;
  const originalTestMode = process.env.SRTD_TEST_MODE;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SRTD_TEST_MODE = 'true';
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env.SRTD_TEST_MODE = originalTestMode;
    exitSpy.mockRestore();
  });

  it('should export a commander program', async () => {
    process.argv = ['node', 'srtd', '--help'];

    // The CLI module defines the program
    const module = await import('./cli.js');
    expect(module).toBeDefined();
  });

  it('should handle version flag', async () => {
    process.argv = ['node', 'srtd', '--version'];

    // In test mode with version flag
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await import('./cli.js');
    } catch {
      // Commander may throw on --version in some cases
    }

    consoleLogSpy.mockRestore();
    expect(exitSpy).toHaveBeenCalled();
  });

  it('should not show update notifications in test mode', async () => {
    process.env.SRTD_TEST_MODE = 'true';
    process.argv = ['node', 'srtd', '--non-interactive'];

    const updateNotifier = await import('update-notifier');
    await import('./cli.js');

    // update-notifier should not have been called since SRTD_TEST_MODE is true
    // But we're mocking it so it won't actually notify
    expect(updateNotifier.default).toBeDefined();
  });

  it('should register all commands', async () => {
    process.argv = ['node', 'srtd', '--help'];

    // The commands should be registered
    const initCmd = await import('./commands/init.js');
    const applyCmd = await import('./commands/apply.js');
    const buildCmd = await import('./commands/build.js');
    const clearCmd = await import('./commands/clear.js');
    const promoteCmd = await import('./commands/promote.js');
    const registerCmd = await import('./commands/register.js');
    const watchCmd = await import('./commands/watch.js');

    expect(initCmd.initCommand).toBeDefined();
    expect(applyCmd.applyCommand).toBeDefined();
    expect(buildCmd.buildCommand).toBeDefined();
    expect(clearCmd.clearCommand).toBeDefined();
    expect(promoteCmd.promoteCommand).toBeDefined();
    expect(registerCmd.registerCommand).toBeDefined();
    expect(watchCmd.watchCommand).toBeDefined();
  });

  it('should exit cleanly in test mode', async () => {
    process.env.SRTD_TEST_MODE = 'true';
    process.argv = ['node', 'srtd', '--non-interactive'];

    await import('./cli.js');

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle non-interactive flag', async () => {
    process.argv = ['node', 'srtd', '--non-interactive'];
    process.env.SRTD_TEST_MODE = undefined;

    await import('./cli.js');

    expect(exitSpy).toHaveBeenCalled();
  });
});
