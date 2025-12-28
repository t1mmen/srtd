// src/commands/watch.ts
import readline from 'node:readline';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import type { TemplateStatus } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import {
  createSpinner,
  renderBranding,
  renderResultRow,
  renderWatchFooter,
  type TemplateResult,
} from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { formatPath } from '../utils/formatPath.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

const MAX_HISTORY = 10;

/** Internal event type for stacking logic */
type WatchEventType = 'changed' | 'applied' | 'error';

/**
 * Stack consecutive events for the same template (unless error).
 * e.g., [changed, applied] for same file becomes one stacked entry.
 */
function stackResults(results: TemplateResult[]): TemplateResult[] {
  const stacked: Array<{ result: TemplateResult; types: WatchEventType[] }> = [];

  for (const result of results) {
    const last = stacked[stacked.length - 1];
    const type = statusToEventType(result.status);

    // Stack if same template and neither is error
    if (
      last &&
      last.result.template === result.template &&
      type !== 'error' &&
      !last.types.includes('error')
    ) {
      // Add type if not already present
      if (!last.types.includes(type)) {
        last.types.push(type);
      }
    } else {
      stacked.push({
        result: { ...result },
        types: [type],
      });
    }
  }

  // Convert back to TemplateResult with displayOverride for stacked events
  return stacked.map(({ result, types }) => {
    if (types.length > 1) {
      // For stacked events, show comma-separated states
      const typeLabels = types.map(t => (t === 'changed' ? chalk.dim(t) : t));
      return { ...result, displayOverride: typeLabels.join(', ') };
    }
    return result;
  });
}

function statusToEventType(status: TemplateResult['status']): WatchEventType {
  switch (status) {
    case 'success':
      return 'applied';
    case 'changed':
      return 'changed';
    case 'error':
      return 'error';
    default:
      return 'changed';
  }
}

/** Reason why a template needs building */
type NeedsBuildReason = 'never-built' | 'outdated';

/**
 * Determine if a template needs building and why.
 * Returns null if template is up-to-date with current build.
 */
function getBuildReason(template: TemplateStatus): NeedsBuildReason | null {
  if (!template.buildState.lastBuildHash) return 'never-built';
  if (template.currentHash !== template.buildState.lastBuildHash) return 'outdated';
  return null;
}

export interface RenderScreenOptions {
  templates: TemplateStatus[];
  recentUpdates: TemplateResult[];
  historicActivity: Array<{
    template: string;
    action: 'built' | 'applied';
    timestamp: Date;
    target?: string;
  }>;
  errors: Map<string, string>;
  config: { templateDir: string; migrationDir: string };
  showHistory: boolean;
  needsBuild: Map<string, NeedsBuildReason>;
}

/** Renders the full watch mode screen with header, history, errors, and instructions */
export function renderScreen(options: RenderScreenOptions): void {
  const { templates, recentUpdates, historicActivity, errors, config, showHistory, needsBuild } =
    options;
  console.clear();

  // Render header
  renderBranding({ subtitle: 'Watch' });

  // Show status line (no src/dest here - dest moved to footer)
  const statusParts: string[] = [`${templates.length} templates`];
  if (needsBuild.size > 0) statusParts.push(chalk.yellow(`${needsBuild.size} need build`));
  if (errors.size > 0) statusParts.push(chalk.red(`${errors.size} errors`));
  console.log(chalk.dim(statusParts.join('  •  ')));
  console.log();

  // History section (if toggled on)
  // Combine recent updates with historic activity
  const hasRecentActivity = recentUpdates.length > 0 || historicActivity.length > 0;
  if (showHistory && hasRecentActivity) {
    console.log(chalk.bold('Recent activity:'));

    // First show stacked recent updates using unified renderer
    const stacked = stackResults(recentUpdates);
    for (const result of stacked) {
      renderResultRow(result, { command: 'watch' });
    }

    // Then show historic activity (if we have room)
    const remainingSlots = MAX_HISTORY - stacked.length;
    if (remainingSlots > 0) {
      const historicToShow = historicActivity.slice(0, remainingSlots);
      for (const entry of historicToShow) {
        // Skip if this template is already shown in recent updates
        const alreadyShown = stacked.some(s => s.template === entry.template);
        if (alreadyShown) continue;

        // Convert historic entry to TemplateResult
        const result: TemplateResult = {
          template: entry.template,
          status: 'success',
          timestamp: entry.timestamp,
        };
        renderResultRow(result, { command: 'watch' });
      }
    }
    console.log();
  }

  // Pending build section with reasons
  if (needsBuild.size > 0) {
    console.log(chalk.yellow.bold('Pending build:'));
    for (const [templatePath, reason] of needsBuild) {
      const label = reason === 'never-built' ? 'never built' : 'changed since build';
      console.log(chalk.yellow(`  ⚡ ${formatPath.truncatePath(templatePath)} (${label})`));
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

  // Footer with keyboard shortcuts and destination
  renderWatchFooter({
    destination: config.migrationDir,
    shortcuts: [
      { key: 'q', label: 'quit' },
      { key: 'b', label: 'build' },
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
      // Render header only if not invoked from menu
      if (!process.env.__SRTD_FROM_MENU__) {
        renderBranding({ subtitle: 'Watch' });
      }

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

      // Load historic activity for initial display
      const historicActivity = orchestrator.getRecentActivity(MAX_HISTORY);

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

      // State for history tracking - now uses unified TemplateResult
      const recentUpdates: TemplateResult[] = [];
      let showHistory = true;

      // Track templates that need building with reason
      const needsBuild = new Map<string, NeedsBuildReason>();

      // Populate needsBuild from initial template state
      for (const template of templates) {
        const reason = getBuildReason(template);
        if (reason) needsBuild.set(template.path, reason);
      }

      // Initial render
      renderScreen({
        templates,
        recentUpdates,
        historicActivity,
        errors,
        config,
        showHistory,
        needsBuild,
      });

      // Helper to call renderScreen with all current state
      const doRender = () => {
        renderScreen({
          templates,
          recentUpdates,
          historicActivity,
          errors,
          config,
          showHistory,
          needsBuild,
        });
      };

      // Set up orchestrator event listeners
      orchestrator.on('templateChanged', (template: TemplateStatus) => {
        // Check if this change invalidates a previous build
        const hadBuild = !!template.buildState.lastBuildHash;

        recentUpdates.push({
          template: template.path,
          status: 'changed',
          timestamp: new Date(),
          buildOutdated: hadBuild,
        });
        if (recentUpdates.length > MAX_HISTORY) recentUpdates.shift();

        // Update needsBuild tracking
        const reason = getBuildReason(template);
        if (reason) needsBuild.set(template.path, reason);

        doRender();
      });

      orchestrator.on('templateApplied', (template: TemplateStatus) => {
        recentUpdates.push({
          template: template.path,
          status: 'success',
          timestamp: new Date(),
        });
        if (recentUpdates.length > MAX_HISTORY) recentUpdates.shift();

        // Track as needing build if not already built with current hash
        const reason = getBuildReason(template);
        if (reason) needsBuild.set(template.path, reason);

        // Clear any previous error for this template
        errors.delete(template.path);

        doRender();
      });

      orchestrator.on(
        'templateError',
        ({ template, error }: { template: TemplateStatus; error: string }) => {
          recentUpdates.push({
            template: template.path,
            status: 'error',
            timestamp: new Date(),
            errorMessage: error,
          });
          if (recentUpdates.length > MAX_HISTORY) recentUpdates.shift();
          errors.set(template.path, error);
          doRender();
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

      /**
       * Extract template name from migration filename.
       * Format: {timestamp}_{prefix}-{templateName}.sql
       * e.g., 20241228_srtd-audit.sql -> audit.sql
       */
      const extractTemplateName = (migrationFile: string): string => {
        const match = migrationFile.match(/_[^-]+-(.+)\.sql$/);
        return match ? `${match[1]}.sql` : migrationFile;
      };

      /**
       * Refresh needsBuild map from current template state.
       * Clears the map and repopulates based on fresh template hashes.
       */
      const refreshNeedsBuild = async (
        orch: Orchestrator,
        templatePaths: string[]
      ): Promise<void> => {
        needsBuild.clear();
        for (const templatePath of templatePaths) {
          try {
            const template = await orch.getTemplateStatusExternal(templatePath);
            const reason = getBuildReason(template);
            if (reason) needsBuild.set(template.path, reason);
          } catch {
            // Template may have been deleted, skip
          }
        }
      };

      // Build action handler for 'b' key
      const triggerBuild = async () => {
        if (!orchestrator) return;

        // Refresh template state before building
        const templatePaths = await orchestrator.findTemplates();
        await refreshNeedsBuild(orchestrator, templatePaths);

        // Check if anything needs building
        if (needsBuild.size === 0) {
          // Show "all up to date" feedback in activity log
          recentUpdates.push({
            template: 'all templates',
            status: 'unchanged',
            timestamp: new Date(),
            displayOverride: 'all up to date',
          });
          if (recentUpdates.length > MAX_HISTORY) recentUpdates.shift();
          doRender();
          return;
        }

        try {
          const result = await orchestrator.build({ silent: true });

          // Add build results to recent updates with 'built' status
          for (const migrationFile of result.built) {
            const templateName = extractTemplateName(migrationFile);
            recentUpdates.push({
              template: templateName,
              status: 'built',
              target: migrationFile,
              timestamp: new Date(),
            });
          }

          if (recentUpdates.length > MAX_HISTORY) {
            recentUpdates.splice(0, recentUpdates.length - MAX_HISTORY);
          }

          // Show any build errors
          for (const err of result.errors) {
            errors.set(err.file, err.error);
          }

          // Refresh needsBuild after building
          await refreshNeedsBuild(orchestrator, templatePaths);
        } catch (error) {
          console.log(chalk.red(`Build failed: ${getErrorMessage(error)}`));
        }

        doRender();
      };

      // Set up keyboard input handling for quit, toggle, and build
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
            doRender();
          }
          if (key && key.name === 'b') {
            void triggerBuild();
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
