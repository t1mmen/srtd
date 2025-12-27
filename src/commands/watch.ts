// src/commands/watch.ts
import path from 'node:path';
import readline from 'node:readline';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import type { TemplateStatus } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import { createSpinner, renderBranding } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

const PATH_DISPLAY_LENGTH = 15;
const MAX_HISTORY = 10;

interface TemplateUpdate {
  type: 'applied' | 'changed' | 'error';
  template: TemplateStatus;
  timestamp: string;
  error?: string;
}

/** Formats an ISO date string as a relative time (e.g., "5m ago") */
export function formatRelativeTime(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Renders the full watch mode screen with header, history, errors, and instructions */
export function renderScreen(
  templates: TemplateStatus[],
  recentUpdates: TemplateUpdate[],
  errors: Map<string, string>,
  templateDir: string,
  showHistory: boolean
): void {
  console.clear();

  // Header with stats
  const needsBuild = templates.filter(
    t => !t.buildState.lastBuildDate || t.currentHash !== t.buildState.lastBuildHash
  ).length;
  console.log(`${chalk.bold('srtd')}${chalk.dim(' - Watch Mode')}`);
  console.log();
  const needsBuildStr = needsBuild > 0 ? chalk.yellow(`[Needs Build: ${needsBuild}]`) : '';
  const errorsStr = errors.size > 0 ? chalk.red(`[Errors: ${errors.size}]`) : '';
  console.log(`${chalk.green(`[Total: ${templates.length}]`)} ${needsBuildStr} ${errorsStr}`);
  console.log();

  // History section (if toggled on)
  if (showHistory && recentUpdates.length > 0) {
    console.log(chalk.bold('Recent activity:'));
    for (const update of recentUpdates) {
      const displayName = formatTemplateDisplay(update.template.path, templateDir);
      const time = formatRelativeTime(update.timestamp);
      const icon =
        update.type === 'applied'
          ? figures.play
          : update.type === 'error'
            ? figures.cross
            : figures.info;
      const color =
        update.type === 'applied' ? chalk.green : update.type === 'error' ? chalk.red : chalk.cyan;
      console.log(
        color(
          `  ${icon} ${displayName}: ${update.type === 'error' ? update.error : update.type} (${time})`
        )
      );
    }
    console.log();
  }

  // Errors section
  if (errors.size > 0) {
    console.log(chalk.red.bold('Errors:'));
    for (const [templatePath, error] of errors) {
      console.log(chalk.red(`  ${formatTemplateDisplay(templatePath, templateDir)}: ${error}`));
    }
    console.log();
  }

  // Instructions
  console.log(
    chalk.dim(
      `Watching for changes... Press ${showHistory ? 'u to hide' : 'u to show'} history, q to quit`
    )
  );
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

export const watchCommand = new Command('watch')
  .description('Watch templates for changes and auto-apply')
  .action(async () => {
    const exitCode = 0;
    let orchestrator: Orchestrator | null = null;

    try {
      await renderBranding({ subtitle: 'Watch Mode' });

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
      renderScreen(templates, recentUpdates, errors, config.templateDir, showHistory);

      // Set up orchestrator event listeners
      orchestrator.on('templateChanged', (template: TemplateStatus) => {
        recentUpdates.unshift({ type: 'changed', template, timestamp: new Date().toISOString() });
        if (recentUpdates.length > MAX_HISTORY) recentUpdates.pop();
        renderScreen(templates, recentUpdates, errors, config.templateDir, showHistory);
      });

      orchestrator.on('templateApplied', (template: TemplateStatus) => {
        recentUpdates.unshift({ type: 'applied', template, timestamp: new Date().toISOString() });
        if (recentUpdates.length > MAX_HISTORY) recentUpdates.pop();
        renderScreen(templates, recentUpdates, errors, config.templateDir, showHistory);
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
          renderScreen(templates, recentUpdates, errors, config.templateDir, showHistory);
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
            renderScreen(templates, recentUpdates, errors, config.templateDir, showHistory);
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
