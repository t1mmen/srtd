import chalk from 'chalk';
// src/commands/apply.ts
import { Command } from 'commander';
import figures from 'figures';
import { formatFatalError, output, writeJson } from '../output/index.js';
import { Orchestrator } from '../services/Orchestrator.js';
import type { ProcessedTemplateResult } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import { type ErrorItem, renderBranding, renderErrorDisplay } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import { toTemplateResults } from '../utils/resultTransformer.js';

export const applyCommand = new Command('apply')
  .description('Apply built migrations to the database')
  .option('-f, --force', 'Force apply of all templates, irrespective of changes')
  .option('--no-deps', 'Disable automatic dependency ordering')
  .option('--json', 'Output results as JSON')
  .action(async (options: { force?: boolean; deps?: boolean; json?: boolean }) => {
    let exitCode = 0;

    try {
      // Render header only if not invoked from menu and not in JSON mode
      if (!process.env.__SRTD_FROM_MENU__ && !options.json) {
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

      // Display validation warnings (skip in JSON mode)
      if (!options.json) {
        displayValidationWarnings(orchestrator.getValidationWarnings());
      }

      // Execute apply operation
      const result: ProcessedTemplateResult = await orchestrator.apply({
        force: options.force,
        silent: true,
        respectDependencies: options.deps,
      });

      // Transform results to unified TemplateResult format using shared transformer
      const context = { command: 'apply' as const, forced: options.force, json: options.json };
      const results = toTemplateResults(
        result,
        (name: string) => orchestrator.getTemplateInfo(name),
        context
      );

      // Output results (JSON or human-readable based on context.json flag)
      output({ results, context });

      // Render errors if any (skip in JSON mode - errors are included in JSON output)
      if (result.errors.length > 0 && !options.json) {
        const errorItems: ErrorItem[] = result.errors.map(err => ({
          template: err.file,
          message: err.error,
          hint: err.hint,
        }));
        renderErrorDisplay({ errors: errorItems });
      }

      exitCode = result.errors.length > 0 ? 1 : 0;
    } catch (error) {
      if (options.json) {
        writeJson(formatFatalError('apply', getErrorMessage(error)));
      } else {
        console.log();
        console.log(chalk.red(`${figures.cross} Error applying templates:`));
        console.log(chalk.red(getErrorMessage(error)));
      }
      exitCode = 1;
    }

    // Exit AFTER the await using block has completed, ensuring dispose() runs
    process.exit(exitCode);
  });
