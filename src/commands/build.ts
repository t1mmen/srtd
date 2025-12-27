import chalk from 'chalk';
// src/commands/build.ts
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import type { ProcessedTemplateResult } from '../types.js';
import { displayValidationWarnings } from '../ui/displayWarnings.js';
import { createSpinner, renderBranding, renderResults } from '../ui/index.js';
import { getConfig, getConfigWarnings } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

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
      // Build subtitle with options
      const parts: string[] = ['Build migrations'];
      if (options.force) parts.push('(forced)');
      if (options.bundle) parts.push('(bundled)');
      const subtitle = parts.join(' ');

      await renderBranding({ subtitle });

      const spinner = createSpinner('Building templates...').start();

      // Initialize Orchestrator
      const projectRoot = await findProjectRoot();
      const config = await getConfig(projectRoot);
      await using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

      // Display validation warnings
      displayValidationWarnings(orchestrator.getValidationWarnings(), getConfigWarnings());

      // Execute build operation
      const buildResult: ProcessedTemplateResult = await orchestrator.build({
        force: options.force,
        bundle: options.bundle,
        silent: true,
      });

      let result = buildResult;

      // If apply flag is set, also apply the templates
      if (options.apply) {
        spinner.text = 'Applying templates...';

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

      spinner.stop();

      // Show results
      renderResults(result, {
        showBuild: true,
        showApply: !!options.apply,
      });

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
