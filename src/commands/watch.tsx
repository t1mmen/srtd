// src/commands/watch.tsx
import path from 'node:path';
import figures from 'figures';
import { terminal } from 'terminal-kit';
import { Branding } from '../components/Branding.js';
import { Orchestrator } from '../services/Orchestrator.js';
import type { TemplateStatus } from '../types.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';

const MAX_FILES = 10;
const MAX_CHANGES = 15;
const PATH_DISPLAY_LENGTH = 15;

interface TemplateUpdate {
  type: 'applied' | 'changed' | 'error';
  template: TemplateStatus;
  timestamp: string;
  error?: string;
}

function formatTemplateDisplay(templatePath: string, templateDir: string): string {
  const parts = templatePath.split(path.sep);
  const filename = parts.pop() || '';
  const dirPath = parts.join(path.sep);

  if (dirPath && templateDir && dirPath.includes(templateDir)) {
    const relativePath = dirPath.substring(dirPath.indexOf(templateDir) + templateDir.length + 1);
    if (relativePath) {
      const truncatedPath = relativePath.slice(-PATH_DISPLAY_LENGTH);
      return `${truncatedPath}/${filename}`;
    }
  }
  return filename;
}

function formatTimeSince(date?: string): string {
  if (!date) return 'never';
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export default async function Watch() {
  const term = terminal;

  // State tracking
  const templates: TemplateStatus[] = [];
  const updates: TemplateUpdate[] = [];
  const errors = new Map<string, string>();
  let isLoading = true;
  let showUpdates = false;
  let lastUpdateTime = Date.now();
  void lastUpdateTime; // Track time for updates

  try {
    // Initialize branding
    term.clear();
    const branding = new Branding(term, { subtitle: '👀 Watch Mode' });
    branding.mount();

    // Initialize Orchestrator
    const projectRoot = await findProjectRoot();
    const config = await getConfig(projectRoot);
    using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

    // Set up keyboard input handling
    term.grabInput(true);
    term.on('key', (key: string) => {
      if (key === 'q' || key === 'CTRL_C') {
        term.processExit(0);
      } else if (key === 'u') {
        showUpdates = !showUpdates;
        renderScreen();
      }
    });

    // Set up orchestrator event listeners
    orchestrator.on('templateChanged', (template: TemplateStatus) => {
      updates.push({
        type: 'changed',
        template,
        timestamp: new Date().toISOString(),
      });

      // Update or add template
      const existingIndex = templates.findIndex(t => t.path === template.path);
      if (existingIndex >= 0) {
        templates[existingIndex] = template;
      } else {
        templates.push(template);
      }

      lastUpdateTime = Date.now();
      renderScreen();
    });

    orchestrator.on('templateApplied', (template: TemplateStatus) => {
      updates.push({
        type: 'applied',
        template,
        timestamp: new Date().toISOString(),
      });

      // Update template
      const existingIndex = templates.findIndex(t => t.path === template.path);
      if (existingIndex >= 0) {
        templates[existingIndex] = template;
      }

      lastUpdateTime = Date.now();
      renderScreen();
    });

    orchestrator.on('templateError', ({ template, error }) => {
      updates.push({
        type: 'error',
        template,
        timestamp: new Date().toISOString(),
        error,
      });

      errors.set(template.path, error);
      lastUpdateTime = Date.now();
      renderScreen();
    });

    // Load initial templates
    const templatePaths = await orchestrator.findTemplates();
    for (const templatePath of templatePaths) {
      try {
        const template = await orchestrator.getTemplateStatusExternal(templatePath);
        templates.push(template);
      } catch (error) {
        errors.set(templatePath, error instanceof Error ? error.message : String(error));
      }
    }

    isLoading = false;

    // Start watching
    const watcher = await orchestrator.watch({
      silent: false,
      initialProcess: true,
    });

    // Render initial screen
    renderScreen();

    // Keep the process alive
    process.on('SIGINT', () => {
      void watcher.close().then(() => {
        term.processExit(0);
      });
    });

    // Render function
    function renderScreen() {
      // Clear screen and move to top
      term.clear();

      // Render branding again
      const branding = new Branding(term, { subtitle: '👀 Watch Mode' });
      branding.mount();

      // Calculate stats
      const stats = {
        total: templates.length,
        needsBuild: templates.filter(
          t => !t.buildState.lastBuildDate || t.currentHash !== t.buildState.lastBuildHash
        ).length,
        recentlyChanged: templates.filter(t => {
          const lastChanged = t.buildState.lastAppliedDate;
          if (!lastChanged) return false;
          return Date.now() - new Date(lastChanged).getTime() < 3600000; // 1 hour
        }).length,
        errors: errors.size,
      };

      // Render stats badges
      term('\n');
      term.green(`[Total: ${stats.total}] `);
      if (stats.needsBuild > 0) {
        term.yellow(`[Needs Build: ${stats.needsBuild}] `);
      }
      if (stats.recentlyChanged > 0) {
        term.cyan(`[Recent Changes: ${stats.recentlyChanged}] `);
      }
      if (stats.errors > 0) {
        term.red(`[Errors: ${stats.errors}] `);
      }
      term('\n\n');

      // Render templates
      if (isLoading) {
        term.yellow('🔍 Finding templates...\n');
      } else {
        term.bold('Recently modified templates:\n');

        const activeTemplates = templates.slice(-MAX_FILES);
        const latestPath = templates.length > 0 ? templates[templates.length - 1]?.path : undefined;

        if (activeTemplates.length === 0) {
          term.dim('No templates found\n');
        } else {
          activeTemplates.forEach(template => {
            const displayName = formatTemplateDisplay(template.path, config.templateDir);
            const isLatest = template.path === latestPath;
            const needsBuild =
              !template.buildState.lastBuildDate ||
              template.currentHash !== template.buildState.lastBuildHash;

            const color = template.buildState.lastAppliedError ? 'red' : 'green';
            const icon = template.buildState.lastAppliedError
              ? figures.cross
              : isLatest
                ? figures.play
                : figures.tick;

            term('  ');
            (term as any)[color](`${icon} `);
            term(`${displayName.padEnd(35)} `);
            term.dim(`applied ${formatTimeSince(template.buildState.lastAppliedDate)}`);

            if (template.wip) {
              term.dim(' wip');
            } else if (needsBuild) {
              term.dim(' needs build');
            } else {
              term.dim(` built ${formatTimeSince(template.buildState.lastBuildDate)} ago`);
            }
            term('\n');
          });
        }

        // Render update log if enabled
        if (showUpdates) {
          term('\n');
          term.bold('Changelog:\n');

          const sortedUpdates = [...updates]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, MAX_CHANGES)
            .reverse();

          if (sortedUpdates.length === 0) {
            term.yellow('⏳ No updates yet, watching...\n');
          } else {
            sortedUpdates.forEach(update => {
              const displayName = formatTemplateDisplay(update.template.path, config.templateDir);
              const icon =
                update.type === 'error'
                  ? figures.cross
                  : update.type === 'applied'
                    ? figures.play
                    : figures.info;
              const color =
                update.type === 'error' ? 'red' : update.type === 'applied' ? 'green' : 'cyan';
              const message =
                update.type === 'error'
                  ? update.error || 'unknown error'
                  : update.type === 'applied'
                    ? 'applied successfully'
                    : 'changed';

              term('  ');
              (term as any)[color](`${icon} ${displayName}: ${message}\n`);
            });
          }
        }

        // Render errors if any
        if (errors.size > 0) {
          term('\n');
          term.red.bold('Errors:\n');
          for (const [templatePath, error] of errors) {
            const displayName = formatTemplateDisplay(templatePath, config.templateDir);
            term('  ');
            term.red(`${displayName}: ${error}\n`);
          }
        }
      }

      // Render controls
      term('\n');
      term.dim('Press ');
      term.bold('q');
      term.dim(' to quit • Press ');
      if (showUpdates) term.underline('u');
      else term.bold('u');
      term.dim(' to toggle updates\n');
    }

    // Set up periodic refresh for time displays
    setInterval(renderScreen, 30000); // Refresh every 30 seconds
  } catch (error) {
    term('\n');
    term.red('❌ Error starting watch mode:\n');
    term.red(error instanceof Error ? error.message : String(error));
    term('\n');
    process.exit(1);
  }
}
