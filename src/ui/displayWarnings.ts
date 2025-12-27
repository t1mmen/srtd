import chalk from 'chalk';
import figures from 'figures';
import type { ValidationWarning } from '../utils/schemas.js';

/**
 * Display validation warnings from orchestrator
 * Shows warnings about corrupted or invalid build log files and config issues
 */
export function displayValidationWarnings(warnings: ValidationWarning[]): void {
  if (warnings.length === 0) return;

  console.log();
  console.log(chalk.yellow(`${figures.warning} Validation Warnings:`));

  for (const w of warnings) {
    const sourceLabel =
      w.source === 'config'
        ? `config (${w.type})`
        : w.source === 'buildLog'
          ? 'buildLog'
          : 'localBuildLog';
    console.log(chalk.yellow(`  ${figures.arrowRight} ${sourceLabel}: ${w.message}`));
    if (w.path) {
      console.log(chalk.dim(`    Path: ${w.path}`));
    }
  }

  console.log();
}
