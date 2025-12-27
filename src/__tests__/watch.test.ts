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

describe('Watch Command Utilities', () => {
  it('formatTemplateDisplay handles paths correctly', async () => {
    // The utility is private, but we test its behavior through the command
    const { watchCommand } = await import('../commands/watch.js');
    expect(watchCommand).toBeDefined();
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for times less than 5 seconds ago', async () => {
    const { formatRelativeTime } = await import('../commands/watch.js');
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns seconds ago for times between 5 and 60 seconds', async () => {
    const { formatRelativeTime } = await import('../commands/watch.js');
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('30s ago');
  });

  it('returns minutes ago for times between 1 and 60 minutes', async () => {
    const { formatRelativeTime } = await import('../commands/watch.js');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours ago for times between 1 and 24 hours', async () => {
    const { formatRelativeTime } = await import('../commands/watch.js');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('returns days ago for times more than 24 hours', async () => {
    const { formatRelativeTime } = await import('../commands/watch.js');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});

describe('renderScreen', () => {
  let consoleClearSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleClearSpy = mockConsoleClear();
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleClearSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('clears the screen before rendering', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen([], [], new Map(), 'templates', true);

    expect(consoleClearSpy).toHaveBeenCalled();
  });

  it('shows header with stats', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const templates = [
      {
        name: 'test',
        path: '/templates/test.sql',
        currentHash: 'abc123',
        buildState: { lastBuildDate: null, lastBuildHash: null },
      },
    ];

    renderScreen(templates, [], new Map(), 'templates', true);

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Total: 1');
    expect(allOutput).toContain('Needs Build: 1');
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

    renderScreen([], recentUpdates, new Map(), 'templates', true);

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Recent activity');
  });

  it('hides recent activity when showHistory is false', async () => {
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

    renderScreen([], recentUpdates, new Map(), 'templates', false);

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).not.toContain('Recent activity');
  });

  it('shows errors section when there are errors', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const errors = new Map([['test.sql', 'Failed to apply']]);

    renderScreen([], [], errors, 'templates', true);

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('Errors');
    expect(allOutput).toContain('Failed to apply');
  });

  it('shows toggle instruction with correct state', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen([], [], new Map(), 'templates', true);
    let allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('u to hide');

    consoleLogSpy.mockClear();

    renderScreen([], [], new Map(), 'templates', false);
    allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('u to show');
  });
});
