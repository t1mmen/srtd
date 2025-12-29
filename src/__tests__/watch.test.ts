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

describe('statusToEventType', () => {
  it('maps success status to applied event', async () => {
    const { statusToEventType } = await import('../commands/watch.js');
    expect(statusToEventType('success')).toBe('applied');
  });

  it('maps changed status to changed event', async () => {
    const { statusToEventType } = await import('../commands/watch.js');
    expect(statusToEventType('changed')).toBe('changed');
  });

  it('maps error status to error event', async () => {
    const { statusToEventType } = await import('../commands/watch.js');
    expect(statusToEventType('error')).toBe('error');
  });

  it('maps unknown status to changed event (default)', async () => {
    const { statusToEventType } = await import('../commands/watch.js');
    // Test statuses that aren't explicitly handled
    expect(statusToEventType('built')).toBe('changed');
    expect(statusToEventType('unchanged')).toBe('changed');
    expect(statusToEventType('skipped')).toBe('changed');
  });
});

describe('getBuildReason', () => {
  it('returns never-built when no lastBuildHash', async () => {
    const { getBuildReason } = await import('../commands/watch.js');
    const template = {
      name: 'test',
      path: '/test.sql',
      currentHash: 'abc123',
      buildState: {},
    };
    expect(getBuildReason(template)).toBe('never-built');
  });

  it('returns outdated when hash differs from lastBuildHash', async () => {
    const { getBuildReason } = await import('../commands/watch.js');
    const template = {
      name: 'test',
      path: '/test.sql',
      currentHash: 'abc123',
      buildState: { lastBuildHash: 'old456' },
    };
    expect(getBuildReason(template)).toBe('outdated');
  });

  it('returns null when template is up-to-date', async () => {
    const { getBuildReason } = await import('../commands/watch.js');
    const template = {
      name: 'test',
      path: '/test.sql',
      currentHash: 'abc123',
      buildState: { lastBuildHash: 'abc123' },
    };
    expect(getBuildReason(template)).toBe(null);
  });
});

describe('stackResults', () => {
  it('returns empty array for empty input', async () => {
    const { stackResults } = await import('../commands/watch.js');
    expect(stackResults([])).toEqual([]);
  });

  it('returns single result unchanged', async () => {
    const { stackResults } = await import('../commands/watch.js');
    const results = [{ template: '/test.sql', status: 'success' as const, timestamp: new Date() }];
    const stacked = stackResults(results);
    expect(stacked).toHaveLength(1);
    expect(stacked[0].template).toBe('/test.sql');
  });

  it('stacks consecutive events for same template', async () => {
    const { stackResults } = await import('../commands/watch.js');
    const results = [
      { template: '/test.sql', status: 'changed' as const, timestamp: new Date() },
      { template: '/test.sql', status: 'success' as const, timestamp: new Date() },
    ];
    const stacked = stackResults(results);
    expect(stacked).toHaveLength(1);
    expect(stacked[0].displayOverride).toContain('changed');
    expect(stacked[0].displayOverride).toContain('applied');
  });

  it('does not stack when error is involved', async () => {
    const { stackResults } = await import('../commands/watch.js');
    const results = [
      { template: '/test.sql', status: 'changed' as const, timestamp: new Date() },
      { template: '/test.sql', status: 'error' as const, timestamp: new Date() },
    ];
    const stacked = stackResults(results);
    expect(stacked).toHaveLength(2);
  });

  it('does not stack different templates', async () => {
    const { stackResults } = await import('../commands/watch.js');
    const results = [
      { template: '/a.sql', status: 'success' as const, timestamp: new Date() },
      { template: '/b.sql', status: 'success' as const, timestamp: new Date() },
    ];
    const stacked = stackResults(results);
    expect(stacked).toHaveLength(2);
  });

  it('does not add duplicate types when stacking same status', async () => {
    const { stackResults } = await import('../commands/watch.js');
    const results = [
      { template: '/test.sql', status: 'success' as const, timestamp: new Date() },
      { template: '/test.sql', status: 'success' as const, timestamp: new Date() },
    ];
    const stacked = stackResults(results);
    expect(stacked).toHaveLength(1);
    // Should not have displayOverride since only one unique type
    expect(stacked[0].displayOverride).toBeUndefined();
  });
});

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

  it('stacks consecutive events for the same template', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    // Two events for same template should be stacked
    const recentUpdates = [
      {
        template: '/templates/test.sql',
        status: 'changed' as const,
        timestamp: new Date(),
      },
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

    // Should only call renderResultRow once (stacked)
    expect(ui.renderResultRow).toHaveBeenCalledTimes(1);
    // The stacked result should have displayOverride with both states
    expect(ui.renderResultRow).toHaveBeenCalledWith(
      expect.objectContaining({
        template: '/templates/test.sql',
        displayOverride: expect.stringContaining('applied'),
      }),
      { command: 'watch' }
    );
  });

  it('does not stack error events', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    // Error events should not be stacked
    const recentUpdates = [
      {
        template: '/templates/test.sql',
        status: 'changed' as const,
        timestamp: new Date(),
      },
      {
        template: '/templates/test.sql',
        status: 'error' as const,
        timestamp: new Date(),
        errorMessage: 'SQL syntax error',
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

    // Should call renderResultRow twice (not stacked due to error)
    expect(ui.renderResultRow).toHaveBeenCalledTimes(2);
  });

  it('does not stack events for different templates', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    const recentUpdates = [
      {
        template: '/templates/a.sql',
        status: 'changed' as const,
        timestamp: new Date(),
      },
      {
        template: '/templates/b.sql',
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

    // Should call renderResultRow twice (different templates)
    expect(ui.renderResultRow).toHaveBeenCalledTimes(2);
  });

  it('shows outdated label for templates changed since build', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map([['/templates/outdated.sql', 'outdated' as const]]),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('changed since build');
  });

  it('limits historic activity based on remaining slots', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    // Fill recent updates to reduce available slots
    const recentUpdates = Array.from({ length: 8 }, (_, i) => ({
      template: `/templates/recent${i}.sql`,
      status: 'success' as const,
      timestamp: new Date(),
    }));

    // Many historic entries - only some should show
    const historicActivity = Array.from({ length: 10 }, (_, i) => ({
      template: `/templates/historic${i}.sql`,
      action: 'applied' as const,
      timestamp: new Date(),
    }));

    renderScreen({
      templates: [],
      recentUpdates,
      historicActivity,
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    // Total calls should be limited to MAX_HISTORY (10)
    // 8 recent + 2 remaining slots for historic = 10
    expect(ui.renderResultRow).toHaveBeenCalledTimes(10);
  });

  it('skips historic entries already shown in recent updates', async () => {
    const { renderScreen } = await import('../commands/watch.js');
    const ui = await import('../ui/index.js');

    const recentUpdates = [
      {
        template: '/templates/shared.sql',
        status: 'success' as const,
        timestamp: new Date(),
      },
    ];

    const historicActivity = [
      {
        template: '/templates/shared.sql', // Same as recent
        action: 'applied' as const,
        timestamp: new Date(),
      },
      {
        template: '/templates/other.sql',
        action: 'built' as const,
        timestamp: new Date(),
      },
    ];

    renderScreen({
      templates: [],
      recentUpdates,
      historicActivity,
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    // Should only show 2 rows: 1 recent + 1 historic (the 'other.sql', not 'shared.sql')
    expect(ui.renderResultRow).toHaveBeenCalledTimes(2);
  });

  it('shows template count in status line', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    const templates = [
      { name: 'a', path: '/a.sql', currentHash: '1', buildState: {} },
      { name: 'b', path: '/b.sql', currentHash: '2', buildState: {} },
      { name: 'c', path: '/c.sql', currentHash: '3', buildState: {} },
    ];

    renderScreen({
      templates,
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('3 templates');
  });

  it('shows singular template when only one', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    const templates = [{ name: 'a', path: '/a.sql', currentHash: '1', buildState: {} }];

    renderScreen({
      templates,
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map(),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('1 template');
    expect(allOutput).not.toContain('1 templates');
  });

  it('shows needs build count in status line', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors: new Map(),
      showHistory: true,
      needsBuild: new Map([
        ['/a.sql', 'never-built'],
        ['/b.sql', 'outdated'],
      ]),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('2 need build');
  });

  it('shows error count in status line', async () => {
    const { renderScreen } = await import('../commands/watch.js');

    renderScreen({
      templates: [],
      recentUpdates: [],
      historicActivity: [],
      errors: new Map([
        ['/a.sql', 'Error 1'],
        ['/b.sql', 'Error 2'],
      ]),
      showHistory: true,
      needsBuild: new Map(),
    });

    const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('2 errors');
  });
});
