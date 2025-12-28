import chalk from 'chalk';
import figures from 'figures';
import { formatPath } from '../utils/formatPath.js';

export interface ResultRow {
  template: string;
  status: 'built' | 'applied' | 'error';
  target?: string; // Migration file for 'built', ignored for 'applied' (shows "local db")
}

export interface UnchangedRow {
  template: string;
  target?: string; // Last migration file (for context)
  lastDate?: string; // ISO date of last build/apply
  lastAction?: 'built' | 'applied'; // What was the last action taken
}

export interface ResultsTableOptions {
  rows: ResultRow[];
  unchanged: UnchangedRow[];
  errorCount?: number;
}

const COL_TEMPLATE = 22;
const COL_TARGET = 32;

/**
 * Format a date string to a compact display format (e.g., "12/25 14:30")
 */
function formatCompactDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * Ensure template name has .sql extension
 */
function ensureSqlExtension(name: string): string {
  const filename = formatPath.getFilename(name);
  return filename.endsWith('.sql') ? filename : `${filename}.sql`;
}

/**
 * Render results as an aligned table with arrow format showing targets.
 *
 * Format (build):
 * ✓ audit.sql           → 20241227_srtd-audit.sql
 *
 * Format (apply):
 * ✓ audit.sql           → local db
 *
 * Format (unchanged):
 * ● users.sql           → 20241225_srtd-users.sql        12/25 10:15
 */
export function renderResultsTable(options: ResultsTableOptions): void {
  const { rows, unchanged, errorCount = 0 } = options;

  // Active rows with icons
  for (const row of rows) {
    const icon =
      row.status === 'built'
        ? chalk.green(figures.tick)
        : row.status === 'applied'
          ? chalk.cyan(figures.tick)
          : chalk.red(figures.cross);

    const templateName = ensureSqlExtension(row.template);
    const templateDisplay = templateName.padEnd(COL_TEMPLATE);

    // For errors, don't show arrow (nothing was created/applied)
    if (row.status === 'error') {
      console.log(`${icon} ${templateDisplay}`);
    } else {
      const arrow = chalk.dim('→');
      // For 'applied', target is always "local db"; for 'built', show migration file
      const targetDisplay = row.status === 'applied' ? 'local db' : row.target || '';
      console.log(`${icon} ${templateDisplay} ${arrow} ${targetDisplay}`);
    }
  }

  // Unchanged rows (muted)
  for (const item of unchanged) {
    const icon = chalk.dim(figures.bullet);
    const templateName = ensureSqlExtension(item.template);
    const templateDisplay = chalk.dim(templateName.padEnd(COL_TEMPLATE));
    const arrow = chalk.dim('→');

    // Show last action context: migration file for build, "local db" for apply
    const targetText = item.lastAction === 'applied' ? 'local db' : item.target || 'local db';
    const targetDisplay = chalk.dim(targetText.padEnd(COL_TARGET));
    const dateDisplay = item.lastDate ? chalk.dim(formatCompactDate(item.lastDate)) : '';

    console.log(`${icon} ${templateDisplay} ${arrow} ${targetDisplay} ${dateDisplay}`);
  }

  // Summary footer
  console.log();

  const builtCount = rows.filter(r => r.status === 'built').length;
  const appliedCount = rows.filter(r => r.status === 'applied').length;
  const parts: string[] = [];

  if (builtCount > 0) parts.push(`Built: ${builtCount}`);
  if (appliedCount > 0) parts.push(`Applied: ${appliedCount}`);
  if (unchanged.length > 0) parts.push(chalk.dim(`Unchanged: ${unchanged.length}`));
  if (errorCount > 0) parts.push(chalk.red(`Errors: ${errorCount}`));

  if (parts.length > 0) {
    console.log(parts.join('  '));
  }

  console.log();
}
