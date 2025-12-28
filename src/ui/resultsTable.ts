import chalk from 'chalk';
import figures from 'figures';
import { formatPath } from '../utils/formatPath.js';
import { formatTime } from '../utils/formatTime.js';
import { TIMESTAMP_COLUMN_WIDTH } from './constants.js';
import { renderErrorContext } from './errorContext.js';
import type { RenderContext, RenderResultsOptions, TemplateResult } from './types.js';

// Re-export types for consumers
export type { RenderContext, RenderResultsOptions, TemplateResult };

const COL_TEMPLATE = 22;
const COL_TARGET = 32;

/**
 * Ensure template name has .sql extension
 */
function ensureSqlExtension(name: string): string {
  const filename = formatPath.getFilename(name);
  return filename.endsWith('.sql') ? filename : `${filename}.sql`;
}

/**
 * Get status label for watch mode display.
 */
function getStatusLabel(status: TemplateResult['status']): string {
  switch (status) {
    case 'success':
      return 'applied';
    case 'built':
      return 'built';
    case 'changed':
      return 'changed';
    case 'error':
      return 'error';
    case 'unchanged':
      return 'unchanged';
  }
}

/**
 * Get icon for a template result status.
 */
function getStatusIcon(status: TemplateResult['status']): string {
  switch (status) {
    case 'success':
    case 'built':
      return chalk.green(figures.tick);
    case 'changed':
      return chalk.dim(figures.bullet);
    case 'unchanged':
      return chalk.dim(figures.bullet);
    case 'error':
      return chalk.red(figures.cross);
  }
}

/**
 * Get color for a status.
 */
function getStatusColor(status: TemplateResult['status']): (text: string) => string {
  switch (status) {
    case 'success':
    case 'built':
      return chalk.green;
    case 'changed':
      return chalk.dim;
    case 'unchanged':
      return chalk.dim;
    case 'error':
      return chalk.red;
  }
}

/**
 * Get target display text for a result.
 * - Build: migration filename
 * - Apply: "local db"
 */
function getTargetDisplay(result: TemplateResult, context: RenderContext): string {
  if (result.status === 'error') return '';
  if (context.command === 'apply' || context.command === 'watch') return 'local db';
  return result.target || '';
}

/**
 * Render a single result row for watch mode (streaming log format).
 * Format: HH:MM:SS  ✔ template.sql applied
 */
function renderWatchRow(result: TemplateResult): void {
  const time = result.timestamp ? formatTime.time(result.timestamp) : '';
  const icon = getStatusIcon(result.status);
  const color = getStatusColor(result.status);
  const truncatedPath = formatPath.truncatePath(result.template);

  // Use displayOverride if provided (for stacked events like "changed, applied")
  let statusLabel = result.displayOverride || getStatusLabel(result.status);

  // Add build outdated annotation for changed status
  if (result.status === 'changed' && result.buildOutdated) {
    statusLabel += chalk.yellow(' (build outdated)');
  }

  // Add arrow for built status with target
  if (result.status === 'built' && result.target) {
    statusLabel += ` ${chalk.dim('→')} ${result.target}`;
  }

  // Build the main line: "16:45:02  ✓ .../file.sql applied"
  const mainLine = `${chalk.dim(time)}  ${icon} ${color(truncatedPath)} ${statusLabel}`;
  console.log(mainLine);

  // For errors, render additional context
  if (result.status === 'error') {
    const indent = ' '.repeat(TIMESTAMP_COLUMN_WIDTH);
    renderErrorContext({
      message: result.errorMessage,
      sqlSnippet: result.errorSqlSnippet,
      column: result.errorColumn,
      indentPrefix: indent,
    });
  }
}

/**
 * Render a single result row for build/apply mode (table format).
 * Format: ✔ template.sql → target
 */
function renderTableRow(result: TemplateResult, context: RenderContext): void {
  const icon = getStatusIcon(result.status);
  const templateName = ensureSqlExtension(result.template);
  const isUnchanged = result.status === 'unchanged';

  const templateDisplay = isUnchanged
    ? chalk.dim(templateName.padEnd(COL_TEMPLATE))
    : templateName.padEnd(COL_TEMPLATE);

  // For errors, don't show arrow (nothing was created/applied)
  if (result.status === 'error') {
    console.log(`${icon} ${templateDisplay}`);
    return;
  }

  const arrow = chalk.dim('→');
  const targetText = getTargetDisplay(result, context);

  if (isUnchanged) {
    // Unchanged: show target and relative time
    const targetDisplay = chalk.dim(targetText.padEnd(COL_TARGET));
    const timeDisplay = result.timestamp ? chalk.dim(formatTime.relative(result.timestamp)) : '';
    console.log(`${icon} ${templateDisplay} ${arrow} ${targetDisplay} ${timeDisplay}`);
  } else {
    // Success: just show target
    console.log(`${icon} ${templateDisplay} ${arrow} ${targetText}`);
  }
}

/**
 * Render a single result row - dispatches to appropriate renderer based on context.
 */
export function renderResultRow(result: TemplateResult, context: RenderContext): void {
  if (context.command === 'watch') {
    renderWatchRow(result);
  } else {
    renderTableRow(result, context);
  }
}

/**
 * Render summary footer with consistent icon format.
 * Pattern: [icon] [message]
 */
function renderSummary(results: TemplateResult[], context: RenderContext): void {
  // No summary for watch mode - it's streaming
  if (context.command === 'watch') return;

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const unchangedCount = results.filter(r => r.status === 'unchanged').length;

  console.log();

  // Show success count if any
  if (successCount > 0) {
    const verb = context.command === 'build' ? 'Built' : 'Applied';
    console.log(
      chalk.green(
        `${figures.tick} ${verb} ${successCount} template${successCount !== 1 ? 's' : ''}`
      )
    );
  }

  // Show error count if any
  if (errorCount > 0) {
    console.log(chalk.red(`${figures.cross} ${errorCount} error${errorCount !== 1 ? 's' : ''}`));
  }

  // If nothing happened (only unchanged), show "No changes"
  if (successCount === 0 && errorCount === 0 && unchangedCount > 0) {
    console.log(chalk.dim(`${figures.bullet} No changes`));
  }
}

/**
 * Render results as an aligned table with arrow format showing targets.
 *
 * Build/Apply Format:
 * ✔ audit.sql           → 20241227_srtd-audit.sql
 * ● users.sql           → 20241225_srtd-users.sql        2 days ago
 * ✘ broken.sql
 *
 * Watch Format:
 * 16:45:02  ✔ .../audit.sql applied
 * 16:45:15  ● .../user.sql changed
 * 16:46:03  ✘ .../broken.sql error
 *           | syntax error at line 5
 */
export function renderResultsTable(options: RenderResultsOptions): void {
  const { results, context } = options;

  // For watch mode, don't sort - preserve chronological order
  if (context.command === 'watch') {
    for (const result of results) {
      renderResultRow(result, context);
    }
    return;
  }

  // For build/apply, sort: success/built first, then unchanged, then errors
  const sorted = [...results].sort((a, b) => {
    const order = { success: 0, built: 1, changed: 2, unchanged: 3, error: 4 };
    return order[a.status] - order[b.status];
  });

  for (const result of sorted) {
    renderResultRow(result, context);
  }

  renderSummary(results, context);
}
