import chalk from 'chalk';
import figures from 'figures';
import { formatPath } from '../utils/formatPath.js';
import { formatTime } from '../utils/formatTime.js';
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
 * Get icon for a template result status.
 */
function getStatusIcon(status: TemplateResult['status'], context: RenderContext): string {
  switch (status) {
    case 'success':
      return context.command === 'build' ? chalk.green(figures.tick) : chalk.cyan(figures.tick);
    case 'unchanged':
      return chalk.dim(figures.bullet);
    case 'error':
      return chalk.red(figures.cross);
    case 'needs-build':
      return chalk.yellow(figures.warning);
  }
}

/**
 * Get target display text for a result.
 * - Build: migration filename
 * - Apply: "local db"
 */
function getTargetDisplay(result: TemplateResult, context: RenderContext): string {
  if (result.status === 'error') return '';
  if (context.command === 'apply') return 'local db';
  return result.target || '';
}

/**
 * Render a single result row.
 */
function renderResultRow(result: TemplateResult, context: RenderContext): void {
  const icon = getStatusIcon(result.status, context);
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
 * Render summary footer.
 * Only shows what happened this run. "Unchanged" count omitted - dim rows ARE the unchanged ones.
 */
function renderSummary(results: TemplateResult[], context: RenderContext): void {
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const unchangedCount = results.filter(r => r.status === 'unchanged').length;

  const parts: string[] = [];

  if (successCount > 0) {
    const verb = context.command === 'build' ? 'Built' : 'Applied';
    parts.push(`${verb}: ${successCount}`);
  }

  if (errorCount > 0) {
    parts.push(chalk.red(`Errors: ${errorCount}`));
  }

  // If nothing happened (only unchanged), show "No changes"
  if (successCount === 0 && errorCount === 0 && unchangedCount > 0) {
    parts.push(chalk.dim('No changes'));
  }

  console.log();
  if (parts.length > 0) {
    console.log(parts.join('  '));
  }
}

/**
 * Render results as an aligned table with arrow format showing targets.
 *
 * Format (build success):
 * ✔ audit.sql           → 20241227_srtd-audit.sql
 *
 * Format (apply success):
 * ✔ audit.sql           → local db
 *
 * Format (unchanged):
 * ● users.sql           → 20241225_srtd-users.sql        2 days ago
 *
 * Format (error):
 * ✘ broken.sql
 */
export function renderResultsTable(options: RenderResultsOptions): void {
  const { results, context } = options;

  // Sort: success first, then unchanged, then errors
  const sorted = [...results].sort((a, b) => {
    const order = { success: 0, 'needs-build': 1, unchanged: 2, error: 3 };
    return order[a.status] - order[b.status];
  });

  for (const result of sorted) {
    renderResultRow(result, context);
  }

  renderSummary(results, context);
}
