import chalk from 'chalk';
// src/commands/apply.ts
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import type { ProcessedTemplateResult } from '../types.js';
import { createSpinner, renderBranding, renderResults } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

export const applyCommand = new Command('apply')
  .description('Apply built migrations to the database')
  .option('-f, --force', 'Force apply of all templates, irrespective of changes')
  .action(async (options: { force?: boolean }) => {
    try {
      await renderBranding({ subtitle: 'Apply migrations' });

      const spinner = createSpinner('Applying templates...').start();

      // Initialize Orchestrator
      const projectRoot = await findProjectRoot();
      const config = await getConfig(projectRoot);
      using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

      // Execute apply operation
      const result: ProcessedTemplateResult = await orchestrator.apply({
        force: options.force,
        silent: true,
      });

      spinner.stop();

      // Show results
      renderResults(result, { showApply: true });

      // Exit cleanly
      process.exit(result.errors.length > 0 ? 1 : 0);
    } catch (error) {
      console.log();
      console.log(chalk.red(`${figures.cross} Error applying templates:`));
      console.log(chalk.red(getErrorMessage(error)));
      process.exit(1);
    }
  });
