import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies before importing
vi.mock('../ui/index.js', () => ({
  renderBranding: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}));

// Mock all command modules
vi.mock('./init.js', () => ({
  initCommand: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./build.js', () => ({
  buildCommand: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./apply.js', () => ({
  applyCommand: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./watch.js', () => ({
  watchCommand: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./register.js', () => ({
  registerCommand: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./promote.js', () => ({
  promoteCommand: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./clear.js', () => ({
  clearCommand: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));

describe('menu', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should export showMenu function', async () => {
    const { showMenu } = await import('./menu.js');
    expect(showMenu).toBeTypeOf('function');
  });

  it('should show branding when menu is displayed', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('init');

    const { renderBranding } = await import('../ui/index.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(renderBranding).toHaveBeenCalled();
  });

  it('should execute init command when selected', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('init');

    const { initCommand } = await import('./init.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(initCommand.parseAsync).toHaveBeenCalledWith(['node', 'srtd', 'init']);
  });

  it('should execute build command when selected', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('build');

    const { buildCommand } = await import('./build.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(buildCommand.parseAsync).toHaveBeenCalledWith(['node', 'srtd', 'build']);
  });

  it('should execute apply command when selected', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('apply');

    const { applyCommand } = await import('./apply.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(applyCommand.parseAsync).toHaveBeenCalledWith(['node', 'srtd', 'apply']);
  });

  it('should execute watch command when selected', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('watch');

    const { watchCommand } = await import('./watch.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(watchCommand.parseAsync).toHaveBeenCalledWith(['node', 'srtd', 'watch']);
  });

  it('should execute register command when selected', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('register');

    const { registerCommand } = await import('./register.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(registerCommand.parseAsync).toHaveBeenCalledWith(['node', 'srtd', 'register']);
  });

  it('should execute promote command when selected', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('promote');

    const { promoteCommand } = await import('./promote.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(promoteCommand.parseAsync).toHaveBeenCalledWith(['node', 'srtd', 'promote']);
  });

  it('should execute clear command when selected', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockResolvedValue('clear');

    const { clearCommand } = await import('./clear.js');
    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(clearCommand.parseAsync).toHaveBeenCalledWith(['node', 'srtd', 'clear']);
  });

  it('should exit gracefully on Ctrl+C', async () => {
    const { select } = await import('@inquirer/prompts');
    const exitError = new Error('User cancelled');
    exitError.name = 'ExitPromptError';
    vi.mocked(select).mockRejectedValue(exitError);

    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should show error and exit on other errors', async () => {
    const { select } = await import('@inquirer/prompts');
    vi.mocked(select).mockRejectedValue(new Error('Something went wrong'));

    const { showMenu } = await import('./menu.js');

    await showMenu();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Error');
  });
});
