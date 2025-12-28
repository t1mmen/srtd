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
  watch: vi.fn().mockResolvedValue(mockWatcher),
  on: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
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
  const mockConfig = { templateDir: 'templates', migrationDir: 'migrations' };

  beforeEach(async () => {
    vi.resetModules();
    consoleClearSpy = mockConsoleClear();
    consoleLogSpy = mockConsoleLog();
    // Clear UI mocks for isolated tests
    const ui = await import('../ui/index.js');
    vi.mocked(ui.renderHeader).mockClear();
    vi.mocked(ui.renderWatchLogEntry).mockClear();
    vi.mocked(ui.renderWatchFooter).mockClear();
  });

  afterEach(() => {
    consoleClearSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('clears the screen before rendering', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen([], [], new Map(), mockConfig, true);

    expect(consoleClearSpy).toHaveBeenCalled();
  });

  it('calls renderHeader with correct options', async () => {
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

    renderScreen(templates, [], new Map(), mockConfig, true);

    expect(ui.renderHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle: 'watch',
        templateDir: 'templates',
        migrationDir: 'migrations',
        templateCount: 1,
        needsBuildCount: 1,
      })
    );
  });

  it('shows recent activity when showHistory is true and there are updates', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const recentUpdates = [
      {
        type: 'applied' as const,
        template: {
          name: 'test',
          path: '/templates/test.sql',
          currentHash: 'abc123',
          buildState: { lastBuildDate: null, lastBuildHash: null },
        },
        timestamp: new Date().toISOString(),
      },
    ];

    renderScreen([], recentUpdates, new Map(), mockConfig, true);

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Recent activity');
  });

  it('calls renderWatchLogEntry for each history item', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');
    const recentUpdates = [
      {
        type: 'applied' as const,
        template: {
          name: 'test',
          path: '/templates/test.sql',
          currentHash: 'abc123',
          buildState: { lastBuildDate: null, lastBuildHash: null },
        },
        timestamp: new Date().toISOString(),
      },
    ];

    renderScreen([], recentUpdates, new Map(), mockConfig, true);

    expect(ui.renderWatchLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'applied',
        template: '/templates/test.sql',
      })
    );
  });

  it('hides recent activity when showHistory is false', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');
    const recentUpdates = [
      {
        type: 'applied' as const,
        template: {
          name: 'test',
          path: '/templates/test.sql',
          currentHash: 'abc123',
          buildState: { lastBuildDate: null, lastBuildHash: null },
        },
        timestamp: new Date().toISOString(),
      },
    ];

    renderScreen([], recentUpdates, new Map(), mockConfig, false);

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).not.toContain('Recent activity');
    expect(ui.renderWatchLogEntry).not.toHaveBeenCalled();
  });

  it('shows errors section when there are errors', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const errors = new Map([['test.sql', 'Failed to apply']]);

    renderScreen([], [], errors, mockConfig, true);

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Errors');
    expect(allOutput).toContain('Failed to apply');
  });

  it('calls renderWatchFooter with correct shortcuts based on showHistory state', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    renderScreen([], [], new Map(), mockConfig, true);
    expect(ui.renderWatchFooter).toHaveBeenCalledWith({
      shortcuts: [
        { key: 'q', label: 'quit' },
        { key: 'u', label: 'hide history' },
      ],
    });

    vi.mocked(ui.renderWatchFooter).mockClear();

    renderScreen([], [], new Map(), mockConfig, false);
    expect(ui.renderWatchFooter).toHaveBeenCalledWith({
      shortcuts: [
        { key: 'q', label: 'quit' },
        { key: 'u', label: 'show history' },
      ],
    });
  });
});
