// src/commands/watch.ts
import readline from 'node:readline';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import packageJson from '../../package.json' with { type: 'json' };
import { Orchestrator } from '../services/Orchestrator.js';
import type { TemplateStatus } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import {
  createSpinner,
  renderHeader,
  renderWatchFooter,
  renderWatchLogEntry,
  type WatchLogEntry,
} from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { formatPath } from '../utils/formatPath.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

const MAX_HISTORY = 10;

interface TemplateUpdate {
  type: 'applied' | 'changed' | 'error';
  template: TemplateStatus;
  timestamp: string;
  error?: string;
}

/** Renders the full watch mode screen with header, history, errors, and instructions */
export function renderScreen(
  templates: TemplateStatus[],
  recentUpdates: TemplateUpdate[],
  errors: Map<string, string>,
  config: { templateDir: string; migrationDir: string },
  showHistory: boolean
): void {
  console.clear();

  // Calculate stats
  const needsBuild = templates.filter(
    t => !t.buildState.lastBuildDate || t.currentHash !== t.buildState.lastBuildHash
  ).length;

  // Render header using new UI component
  renderHeader({
    subtitle: 'watch',
    version: packageJson.version,
    templateDir: config.templateDir,
    migrationDir: config.migrationDir,
    templateCount: templates.length,
    needsBuildCount: needsBuild,
  });

  // History section (if toggled on)
  if (showHistory && recentUpdates.length > 0) {
    console.log(chalk.bold('Recent activity:'));
    for (const update of recentUpdates) {
      const entry: WatchLogEntry = {
        type: update.type === 'applied' ? 'applied' : update.type === 'error' ? 'error' : 'changed',
        template: update.template.path,
        timestamp: new Date(update.timestamp),
        message: update.error,
      };
      renderWatchLogEntry(entry);
    }
    console.log();
  }

  // Errors section
  if (errors.size > 0) {
    console.log(chalk.red.bold('Errors:'));
    for (const [templatePath, error] of errors) {
      console.log(chalk.red(`  ${formatPath.truncatePath(templatePath)}: ${error}`));
    }
    console.log();
  }

  // Footer with keyboard shortcuts
  renderWatchFooter({
    shortcuts: [
      { key: 'q', label: 'quit' },
      { key: 'u', label: showHistory ? 'hide history' : 'show history' },
    ],
  });
}

export const watchCommand = new Command('watch')
  .description('Watch templates for changes and auto-apply')
  .action(async () => {
    const exitCode = 0;
    let orchestrator: Orchestrator | null = null;

    try {
      const spinner = createSpinner('Starting watch mode...').start();

      // Initialize Orchestrator
      const projectRoot = await findProjectRoot();
      const { config, warnings: configWarnings } = await getConfig(projectRoot);
      orchestrator = await Orchestrator.create(projectRoot, config, {
        silent: true,
        configWarnings,
      });

      // Display validation warnings
      displayValidationWarnings(orchestrator.getValidationWarnings());

      // Load initial templates
      const templatePaths = await orchestrator.findTemplates();
      const templates: TemplateStatus[] = [];
      const errors = new Map<string, string>();

      for (const templatePath of templatePaths) {
        try {
          const template = await orchestrator.getTemplateStatusExternal(templatePath);
          templates.push(template);
        } catch (error) {
          errors.set(templatePath, getErrorMessage(error));
        }
      }

      spinner.succeed(`Watching ${templates.length} template(s)`);

      // State for history tracking
      const recentUpdates: TemplateUpdate[] = [];
      let showHistory = true;

      // Initial render
      renderScreen(templates, recentUpdates, errors, config, showHistory);

      // Set up orchestrator event listeners
      orchestrator.on('templateChanged', (template: TemplateStatus) => {
        recentUpdates.unshift({ type: 'changed', template, timestamp: new Date().toISOString() });
        if (recentUpdates.length > MAX_HISTORY) recentUpdates.pop();
        renderScreen(templates, recentUpdates, errors, config, showHistory);
      });

      orchestrator.on('templateApplied', (template: TemplateStatus) => {
        recentUpdates.unshift({ type: 'applied', template, timestamp: new Date().toISOString() });
        if (recentUpdates.length > MAX_HISTORY) recentUpdates.pop();
        renderScreen(templates, recentUpdates, errors, config, showHistory);
      });

      orchestrator.on(
        'templateError',
        ({ template, error }: { template: TemplateStatus; error: string }) => {
          recentUpdates.unshift({
            type: 'error',
            template,
            timestamp: new Date().toISOString(),
            error,
          });
          if (recentUpdates.length > MAX_HISTORY) recentUpdates.pop();
          errors.set(template.path, error);
          renderScreen(templates, recentUpdates, errors, config, showHistory);
        }
      );

      // Start watching
      const watcher = await orchestrator.watch({
        silent: false,
        initialProcess: true,
      });

      // Cleanup function to properly dispose
      const cleanup = async () => {
        console.log();
        console.log(chalk.dim('Stopping watch mode...'));
        await watcher.close();
        if (orchestrator) {
          await orchestrator.dispose();
        }
        process.exit(exitCode);
      };

      // Set up keyboard input handling for quit and toggle
      if (process.stdin.isTTY) {
        // Reset stdin state in case it was modified by previous prompts
        process.stdin.setRawMode(false);
        process.stdin.removeAllListeners('keypress');
        process.stdin.pause();

        // Now set up fresh keypress handling
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.resume();

        process.stdin.on('keypress', (_str, key) => {
          if (key && (key.name === 'q' || (key.ctrl && key.name === 'c'))) {
            process.stdin.setRawMode(false);
            void cleanup();
          }
          if (key && key.name === 'u') {
            showHistory = !showHistory;
            renderScreen(templates, recentUpdates, errors, config, showHistory);
          }
        });
      }

      // Handle SIGINT
      process.on('SIGINT', () => {
        void cleanup();
      });

      // Keep the process alive
      await new Promise(() => {
        // This promise never resolves, keeping the process alive
        // The process will be terminated by the keyboard handler or SIGINT
      });
    } catch (error) {
      console.log();
      console.log(chalk.red(`${figures.cross} Error starting watch mode:`));
      console.log(chalk.red(getErrorMessage(error)));
      if (orchestrator) {
        await orchestrator.dispose();
      }
      process.exit(1);
    }
  });
