import chalk from 'chalk';
import figures from 'figures';
import { formatPath } from '../utils/formatPath.js';
import { SEPARATOR } from './constants.js';

export interface ErrorItem {
  template: string; // Path to template file
  message: string; // Error message
  line?: number; // Line number if available
  sqlSnippet?: string; // SQL code around error
  column?: number; // Column for caret positioning
}

export interface ErrorDisplayOptions {
  errors: ErrorItem[];
}

/**
 * Renders the error display with SQL context and color coding.
 *
 * Format:
 * ERRORS
 * ─────────────────────────────────────────────────────
 * X .../views/broken.sql
 *   | syntax error at line 5:
 *   | CREATE OR REPLACE FUNCTION broken_func(
 *   |                                        ^ expected parameter
 * ─────────────────────────────────────────────────────
 */
export function renderErrorDisplay(options: ErrorDisplayOptions): void {
  const { errors } = options;

  if (errors.length === 0) {
    return;
  }

  // Header
  console.log(chalk.red.bold('ERRORS'));
  console.log(chalk.dim(SEPARATOR));

  // Render each error
  for (const error of errors) {
    renderError(error);
    console.log(); // Blank line between errors
  }

  // Footer
  console.log(chalk.dim(SEPARATOR));
}

/**
 * Renders a single error item with optional SQL context.
 */
function renderError(error: ErrorItem): void {
  const truncatedPath = formatPath.truncatePath(error.template);
  const gutter = chalk.dim('│');

  // Error header: X .../path/to/file.sql
  console.log(chalk.red(`${figures.cross} ${truncatedPath}`));

  // Error message
  console.log(`  ${gutter} ${chalk.red(error.message)}`);

  // SQL snippet (if available)
  if (error.sqlSnippet) {
    console.log(`  ${gutter} ${error.sqlSnippet}`);

    // Caret pointer (if column is available)
    if (error.column !== undefined) {
      // Position caret: account for gutter prefix ("  | ")
      const caretPosition = error.column - 1; // columns are 1-based
      const caretLine = ' '.repeat(caretPosition) + chalk.yellow('^');
      console.log(`  ${gutter} ${caretLine}`);
    }
  }
}
