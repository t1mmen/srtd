import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockFindProjectRoot,
  createMockUiModule,
  mockConsoleClear,
  mockConsoleLog,
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

const mockWatcher = {
  close: vi.fn().mockResolvedValue(undefined),
};

const mockOrchestrator = {
  findTemplates: vi.fn().mockResolvedValue(['/test/project/templates/test.sql']),
  getTemplateStatusExternal: vi.fn().mockResolvedValue({
    name: 'test',
    path: '/test/project/templates/test.sql',
    currentHash: 'abc123',
    buildState: {
      lastBuildDate: null,
      lastBuildHash: null,
    },
  }),
  getRecentActivity: vi.fn().mockReturnValue([]),
  watch: vi.fn().mockResolvedValue(mockWatcher),
  on: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
  getValidationWarnings: vi.fn().mockReturnValue([]),
  [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
  [Symbol.dispose]: vi.fn(),
};

vi.mock('../services/Orchestrator.js', () => ({
  Orchestrator: {
    create: vi.fn().mockResolvedValue(mockOrchestrator),
  },
}));

vi.mock('node:readline', () => ({
  default: {
    emitKeypressEvents: vi.fn(),
  },
}));

describe('Watch Command', () => {
  let spies: ReturnType<typeof setupCommandTestSpies>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    spies = setupCommandTestSpies();
    originalIsTTY = process.stdin.isTTY;
    // Mock stdin as non-TTY to avoid setting up raw mode in tests
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });
  });

  afterEach(() => {
    spies.cleanup();
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('exports watchCommand as a Commander command', async () => {
    const { watchCommand } = await import('../commands/watch.js');
    expect(watchCommand).toBeInstanceOf(Command);
    expect(watchCommand.name()).toBe('watch');
  });

  it('has correct description', async () => {
    const { watchCommand } = await import('../commands/watch.js');
    expect(watchCommand.description()).toBe('Watch templates for changes and auto-apply');
  });

  it('handles errors gracefully', async () => {
    const Orchestrator = (await import('../services/Orchestrator.js')).Orchestrator;
    vi.mocked(Orchestrator.create).mockRejectedValue(new Error('DB connection failed'));

    const { watchCommand } = await import('../commands/watch.js');

    await watchCommand.parseAsync(['node', 'test']);

    expect(spies.exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles template loading errors', async () => {
    mockOrchestrator.getTemplateStatusExternal.mockRejectedValue(new Error('Template error'));

    const { watchCommand } = await import('../commands/watch.js');

    // This should not throw - errors are collected, but we don't assert on stderr
    // because template errors are expected and handled internally
    await expect(watchCommand.parseAsync(['node', 'test'])).resolves.not.toThrow();
  });
});

// Note: formatRelativeTime was removed - use formatTime.relative from ../utils/formatTime.js
// Tests for relative time formatting are in ../utils/formatTime.test.ts

describe('renderScreen', () => {
  let consoleClearSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    consoleClearSpy = mockConsoleClear();
    consoleLogSpy = mockConsoleLog();
    // Clear UI mocks for isolated tests
    const ui = await import('../ui/index.js');
    vi.mocked(ui.renderBranding).mockClear();
    vi.mocked(ui.renderResultRow).mockClear();
    vi.mocked(ui.renderWatchFooter).mockClear();
  });

  afterEach(() => {
    consoleClearSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('clears the screen before rendering', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    expect(consoleClearSpy).toHaveBeenCalled();
  });

  it('calls renderBranding with Watch subtitle', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');
    const templates = [
      {
        name: 'test',
        path: '/templates/test.sql',
        currentHash: 'abc123',
        buildState: { lastBuildDate: null, lastBuildHash: null },
      },
    ];

    renderScreen({
      templates,
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    expect(ui.renderBranding).toHaveBeenCalledWith({ subtitle: 'Watch' });
  });

  it('shows recent activity when showHistory is true and there are updates', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const recentUpdates = [
      {
        template: '/templates/test.sql',
        status: 'success' as const,
        timestamp: new Date(),
      },
    ];

    renderScreen({
      templates: [],
      recentUpdates,
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Recent activity');
  });

  it('calls renderResultRow for each history item', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');
    const recentUpdates = [
      {
        template: '/templates/test.sql',
        status: 'success' as const,
        timestamp: new Date(),
      },
    ];

    renderScreen({
      templates: [],
      recentUpdates,
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    expect(ui.renderResultRow).toHaveBeenCalledWith(
      expect.objectContaining({
        template: '/templates/test.sql',
        status: 'success',
      }),
      { command: 'watch' }
    );
  });

  it('hides recent activity when showHistory is false', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');
    const recentUpdates = [
      {
        template: '/templates/test.sql',
        status: 'success' as const,
        timestamp: new Date(),
      },
    ];

    renderScreen({
      templates: [],
      recentUpdates,
      historicActivity: [],
      errors: new Map(),
      showHistory: false,
      needsBuild: new Map(),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).not.toContain('Recent activity');
    expect(ui.renderResultRow).not.toHaveBeenCalled();
  });

  it('shows errors section when there are errors', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const errors = new Map([['test.sql', 'Failed to apply']]);

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors,
      showHistory: true,
      needsBuild: new Map(),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Errors');
    expect(allOutput).toContain('Failed to apply');
  });

  it('calls renderWatchFooter with correct shortcuts', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });
    expect(ui.renderWatchFooter).toHaveBeenCalledWith({
      shortcuts: [
        { key: 'q', label: 'quit' },
        { key: 'b', label: 'build' },
        { key: 'u', label: 'hide history' },
      ],
    });

    vi.mocked(ui.renderWatchFooter).mockClear();

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: false,
      needsBuild: new Map(),
    });
    expect(ui.renderWatchFooter).toHaveBeenCalledWith({
      shortcuts: [
        { key: 'q', label: 'quit' },
        { key: 'b', label: 'build' },
        { key: 'u', label: 'show history' },
      ],
    });
  });

  it('shows pending build section when templates need build', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map([['/templates/pending.sql', 'never-built' as const]]),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Pending build');
    expect(allOutput).toContain('⚡');
    expect(allOutput).toContain('never built');
  });

  it('shows historic activity when no recent updates', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    const historicActivity = [
      {
        template: '/templates/historic.sql',
        action: 'applied' as const,
        timestamp: new Date(),
        target: 'local db',
      },
    ];

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity,
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Recent activity');
    expect(ui.renderResultRow).toHaveBeenCalled();
  });
});
