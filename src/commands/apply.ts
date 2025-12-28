import chalk from 'chalk';
// src/commands/apply.ts
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import type { ProcessedTemplateResult } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import {
  createSpinner,
  type ErrorItem,
  type ResultRow,
  renderBranding,
  renderErrorDisplay,
  renderResultsTable,
  type UnchangedRow,
} from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

export const applyCommand = new Command('apply')
  .description('Apply built migrations to the database')
  .option('-f, --force', 'Force apply of all templates, irrespective of changes')
  .action(async (options: { force?: boolean }) => {
    let exitCode = 0;

    try {
      // Render header only if not invoked from menu
      if (!process.env.__SRTD_FROM_MENU__) {
        const parts: string[] = ['Apply'];
        if (options.force) parts.push('(forced)');
        renderBranding({ subtitle: parts.join(' ') });
      }

      const spinner = createSpinner('Applying templates...').start();

      // Initialize Orchestrator
      const projectRoot = await findProjectRoot();
      const { config, warnings: configWarnings } = await getConfig(projectRoot);
      await using orchestrator = await Orchestrator.create(projectRoot, config, {
        silent: true,
        configWarnings,
      });

      // Display validation warnings
      displayValidationWarnings(orchestrator.getValidationWarnings());

      // Execute apply operation
      const result: ProcessedTemplateResult = await orchestrator.apply({
        force: options.force,
        silent: true,
      });

      spinner.stop();

      // Transform results to new format
      const rows: ResultRow[] = [
        // Applied templates
        ...result.applied.map(name => ({
          template: name,
          status: 'applied' as const,
        })),
        // Error templates
        ...result.errors.map(err => ({
          template: err.file,
          status: 'error' as const,
        })),
      ];

      // Transform skipped to UnchangedRow - for apply, show "local db" context
      const unchanged: UnchangedRow[] = result.skipped.map(name => {
        const info = orchestrator.getTemplateInfo(name);
        return {
          template: name,
          lastDate: info.lastDate,
          lastAction: 'applied' as const,
        };
      });

      // Render results table with summary footer
      renderResultsTable({
        rows,
        unchanged,
        errorCount: result.errors.length,
      });

      // Render errors if any
      if (result.errors.length > 0) {
        const errorItems: ErrorItem[] = result.errors.map(err => ({
          template: err.file,
          message: err.error,
        }));
        renderErrorDisplay({ errors: errorItems });
      }

      exitCode = result.errors.length > 0 ? 1 : 0;
    } catch (error) {
      console.log();
      console.log(chalk.red(`${figures.cross} Error applying templates:`));
      console.log(chalk.red(getErrorMessage(error)));
      exitCode = 1;
    }

    // Exit AFTER the await using block has completed, ensuring dispose() runs
    process.exit(exitCode);
  });
