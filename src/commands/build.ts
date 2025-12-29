import chalk from 'chalk';
// src/commands/build.ts
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
import { isWipTemplate } from '../utils/isWipTemplate.js';

interface BuildOptions {
  force?: boolean;
  apply?: boolean;
  bundle?: boolean;
}

export const buildCommand = new Command('build')
  .description('Build migrations from templates')
  .option('-f, --force', 'Force building of all templates, irrespective of changes')
  .option('-a, --apply', 'Apply the built templates')
  .option('-b, --bundle', 'Bundle all templates into a single migration')
  .action(async (options: BuildOptions) => {
    let exitCode = 0;

    try {
      // Render header only if not invoked from menu
      if (!process.env.__SRTD_FROM_MENU__) {
        const parts: string[] = ['Build'];
        if (options.force) parts.push('(forced)');
        if (options.bundle) parts.push('(bundled)');
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

      // Execute build operation
      const buildResult: ProcessedTemplateResult = await orchestrator.build({
        force: options.force,
        bundle: options.bundle,
        silent: true,
      });

      let result = buildResult;

      // If apply flag is set, also apply the templates
      if (options.apply) {
        const applyResult: ProcessedTemplateResult = await orchestrator.apply({
          force: options.force,
          silent: true,
        });

        // Merge results
        result = {
          errors: [...buildResult.errors, ...applyResult.errors],
          applied: applyResult.applied,
          built: buildResult.built,
          skipped: [...buildResult.skipped, ...applyResult.skipped],
        };
      }

      // Transform results to unified TemplateResult format
      // Order: unchanged/skipped first, then newly built (newest at bottom, log-style)
      const results: TemplateResult[] = [
        // Skipped templates - either 'skipped' (WIP) or 'unchanged' (already built)
        ...result.skipped.map(name => {
          const info = orchestrator.getTemplateInfo(name);
          const isWip = isWipTemplate(name, config.wipIndicator);
          return {
            template: name,
            status: isWip ? ('skipped' as const) : ('unchanged' as const),
            target: isWip ? undefined : info.migrationFile,
            timestamp: info.lastDate ? new Date(info.lastDate) : undefined,
          };
        }),
        // Built templates (success) - at the bottom as "newest"
        ...result.built.map(name => {
          const info = orchestrator.getTemplateInfo(name);
          return {
            template: name,
            status: 'success' as const,
            target: info.migrationFile,
          };
        }),
        // Error templates - at the very bottom (most important to see)
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
        context: { command: 'build', forced: options.force },
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
      // Exit happens after using block completes (dispose runs)
    } catch (error) {
      console.log();
      console.log(chalk.red(`${figures.cross} Error building templates:`));
      console.log(chalk.red(getErrorMessage(error)));
      exitCode = 1;
    }

    // Exit AFTER the using block has completed, ensuring dispose() runs
    process.exit(exitCode);
  });
