import chalk from 'chalk';
// src/commands/apply.ts
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import type { ProcessedTemplateResult } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import {
  type ErrorItem,
  renderBranding,
  renderErrorDisplay,
  renderResultsTable,
  type TemplateResult,
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

      // Transform results to unified TemplateResult format
      // Log-style ordering: unchanged (old) at top, applied (new) at bottom
      const results: TemplateResult[] = [
        // Skipped templates (unchanged) - old, at top
        ...result.skipped.map(name => {
          const info = orchestrator.getTemplateInfo(name);
          return {
            template: name,
            status: 'unchanged' as const,
            timestamp: info.lastDate ? new Date(info.lastDate) : undefined,
          };
        }),
        // Applied templates (success) - new, at bottom
        ...result.applied.map(name => ({
          template: name,
          status: 'success' as const,
        })),
        // Error templates - at bottom with applied
        ...result.errors.map(err => ({
          template: err.file,
          status: 'error' as const,
          errorMessage: err.error,
          errorHint: err.hint,
        })),
      ];

      // Render results table with unified format
      renderResultsTable({
        results,
        context: { command: 'apply', forced: options.force },
      });

      // Render errors if any
      if (result.errors.length > 0) {
        const errorItems: ErrorItem[] = result.errors.map(err => ({
          template: err.file,
          message: err.error,
          hint: err.hint,
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
