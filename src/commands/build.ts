import chalk from 'chalk';
// src/commands/build.ts
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

interface BuildOptions {
  force?: boolean;
  apply?: boolean;
  bundle?: boolean;
  deps?: boolean;
  json?: boolean;
}

export const buildCommand = new Command('build')
  .description('Build migrations from templates')
  .option('-f, --force', 'Force building of all templates, irrespective of changes')
  .option('-a, --apply', 'Apply the built templates')
  .option('-b, --bundle', 'Bundle all templates into a single migration')
  .option('--no-deps', 'Disable automatic dependency ordering')
  .option('--json', 'Output results as JSON')
  .action(async (options: BuildOptions) => {
    let exitCode = 0;

    try {
      // Render header only if not invoked from menu and not in JSON mode
      if (!process.env.__SRTD_FROM_MENU__ && !options.json) {
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

      // Display validation warnings (skip in JSON mode)
      if (!options.json) {
        displayValidationWarnings(orchestrator.getValidationWarnings());
      }

      // Execute build operation
      const buildResult: ProcessedTemplateResult = await orchestrator.build({
        force: options.force,
        bundle: options.bundle,
        silent: true,
        respectDependencies: options.deps,
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

      // Transform results to unified TemplateResult format using shared transformer
      const context = { command: 'build' as const, forced: options.force, json: options.json };
      const results = toTemplateResults(
        result,
        (name: string) => orchestrator.getTemplateInfo(name),
        context,
        { wipIndicator: config.wipIndicator }
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
      // Exit happens after using block completes (dispose runs)
    } catch (error) {
      if (options.json) {
        writeJson(formatFatalError('build', getErrorMessage(error)));
      } else {
        console.log();
        console.log(chalk.red(`${figures.cross} Error building templates:`));
        console.log(chalk.red(getErrorMessage(error)));
      }
      exitCode = 1;
    }

    // Exit AFTER the using block has completed, ensuring dispose() runs
    process.exit(exitCode);
  });
