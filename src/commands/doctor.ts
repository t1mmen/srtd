/**
 * Doctor command - Read-only diagnostic that validates SRTD setup
 */

import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { SEPARATOR } from '../ui/constants.js';
import { renderBranding } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { type DoctorCheckResult, runAllChecks } from '../utils/doctorChecks.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

/**
 * Render check result as a formatted line
 */
function renderCheckResult(result: DoctorCheckResult): void {
  if (result.passed) {
    console.log(chalk.green(`${figures.tick} ${result.name}`));
  } else {
    console.log(chalk.red(`${figures.cross} ${result.name}`));
    if (result.message) {
      console.log(chalk.dim(`  ${figures.arrowRight} ${result.message}`));
    }
  }
}

/**
 * Render horizontal separator
 */
function renderSeparator(): void {
  console.log(chalk.dim(SEPARATOR));
}

/**
 * Render summary line
 */
function renderSummary(results: DoctorCheckResult[]): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  if (failed === 0) {
    console.log(chalk.green(`${passed} checks passed, no issues found`));
  } else {
    console.log(
      chalk.yellow(`${passed} checks passed, ${failed} ${failed === 1 ? 'issue' : 'issues'} found`)
    );
  }
}

export const doctorCommand = new Command('doctor')
  .description('Validate SRTD setup and configuration')
  .action(async () => {
    let exitCode = 0;

    try {
      await renderBranding({ subtitle: 'Doctor' });

      const projectRoot = await findProjectRoot();
      const { config, warnings } = await getConfig(projectRoot);

      console.log();
      renderSeparator();
      console.log();

      // Run all checks
      const results = await runAllChecks(projectRoot, config, warnings);

      // Display results
      for (const result of results) {
        renderCheckResult(result);
      }

      console.log();
      renderSeparator();

      // Summary
      renderSummary(results);

      // Set exit code based on failures
      const hasFailures = results.some(r => !r.passed);
      exitCode = hasFailures ? 1 : 0;
    } catch (error) {
      console.log();
      console.log(chalk.red(`${figures.cross} Error running doctor:`));
      console.log(chalk.red(getErrorMessage(error)));
      exitCode = 1;
    }

    process.exit(exitCode);
  });
