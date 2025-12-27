import chalk from 'chalk';
import figures from 'figures';
import type { ValidationWarning } from '../services/StateService.js';
import type { ValidationWarning as ConfigValidationWarning } from '../utils/config.js';

/**
 * Display validation warnings from state service and config
 * Shows warnings about corrupted or invalid build log files and config issues
 */
export function displayValidationWarnings(
  warnings: ValidationWarning[],
  configWarnings: ConfigValidationWarning[]
): void {
  // Combine both types of warnings
  const hasWarnings = warnings.length > 0 || configWarnings.length > 0;
  if (!hasWarnings) return;

  console.log();
  console.log(chalk.yellow(`${figures.warning} Validation Warnings:`));

  // Display state service warnings (build log issues)
  for (const w of warnings) {
    console.log(chalk.yellow(`  ${figures.arrowRight} ${w.file}: ${w.error}`));
    if (w.path) {
      console.log(chalk.dim(`    Path: ${w.path}`));
    }
  }

  // Display config warnings
  for (const w of configWarnings) {
    const label = w.type === 'parse' ? 'config (parse)' : 'config (validation)';
    console.log(chalk.yellow(`  ${figures.arrowRight} ${label}: ${w.message}`));
    if (w.path) {
      console.log(chalk.dim(`    Path: ${w.path}`));
    }
  }

  console.log();
}
