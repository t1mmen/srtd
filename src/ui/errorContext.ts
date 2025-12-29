import chalk from 'chalk';

export interface ErrorContextOptions {
  message?: string;
  sqlSnippet?: string;
  column?: number;
  indentPrefix?: string; // '' for errorDisplay, timestamp-width for watch mode
}

/**
 * Renders error context with gutter lines.
 * Shared between errorDisplay and resultsTable (watch mode).
 *
 * Format:
 *   | error message
 *   | SQL snippet
 *   |                    ^ caret
 */
export function renderErrorContext(options: ErrorContextOptions): void {
  const gutter = chalk.dim('\u2502'); // Unicode box drawing vertical line
  const indent = options.indentPrefix ?? '';

  if (options.message) {
    console.log(`${indent}${gutter} ${chalk.red(options.message)}`);
  }
  if (options.sqlSnippet) {
    console.log(`${indent}${gutter} ${options.sqlSnippet}`);
    if (options.column !== undefined && options.column > 0) {
      const caretLine = ' '.repeat(options.column - 1) + chalk.yellow('^');
      console.log(`${indent}${gutter} ${caretLine}`);
    }
  }
}
