import chalk from 'chalk';
// src/commands/apply.ts
import { Command } from 'commander';
import figures from 'figures';
import packageJson from '../../package.json' with { type: 'json' };
import { Orchestrator } from '../services/Orchestrator.js';
import type { ProcessedTemplateResult } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import {
  createSpinner,
  type ErrorItem,
  type ResultRow,
  renderErrorDisplay,
  renderHeader,
  renderResultsTable,
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
      // Build subtitle with options
      const parts: string[] = ['apply'];
      if (options.force) parts.push('(forced)');
      const subtitle = parts.join(' ');

      // Initialize Orchestrator first to get config for header
      const projectRoot = await findProjectRoot();
      const { config, warnings: configWarnings } = await getConfig(projectRoot);
      await using orchestrator = await Orchestrator.create(projectRoot, config, {
        silent: true,
        configWarnings,
      });

      // Render header with context
      renderHeader({
        subtitle,
        version: packageJson.version,
        templateDir: config.templateDir,
        migrationDir: config.migrationDir,
      });

      const spinner = createSpinner('Applying templates...').start();

      // Display validation warnings
      displayValidationWarnings(orchestrator.getValidationWarnings());

      // Execute apply operation
      const result: ProcessedTemplateResult = await orchestrator.apply({
        force: options.force,
        silent: true,
      });

      spinner.stop();

      // Transform results to new format
      const rows: ResultRow[] = result.applied.map(name => ({
        template: name,
        status: 'applied' as const,
      }));

      // Render results table
      renderResultsTable({
        rows,
        unchanged: result.skipped,
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
