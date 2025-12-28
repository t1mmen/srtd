import chalk from 'chalk';
import { formatPath } from '../utils/formatPath.js';

export interface ResultRow {
  template: string;
  status: 'built' | 'applied' | 'error';
  output?: string;
}

export interface ResultsTableOptions {
  rows: ResultRow[];
  unchanged: string[];
  errorCount?: number;
}

const COL_TEMPLATE = 35;
const COL_STATUS = 10;

/**
 * Render results as an aligned table with compact unchanged line.
 */
export function renderResultsTable(options: ResultsTableOptions): void {
  const { rows, unchanged, errorCount = 0 } = options;

  // Table header
  console.log(chalk.dim('TEMPLATE'.padEnd(COL_TEMPLATE) + 'STATUS'.padEnd(COL_STATUS) + 'OUTPUT'));

  // Table rows
  for (const row of rows) {
    const templateDisplay = formatPath.truncatePath(row.template).padEnd(COL_TEMPLATE);
    const statusColor =
      row.status === 'built' ? chalk.green : row.status === 'applied' ? chalk.cyan : chalk.red;
    const statusDisplay = statusColor(row.status.padEnd(COL_STATUS));
    const outputDisplay = row.output || '';
    console.log(`${templateDisplay}${statusDisplay}${outputDisplay}`);
  }

  // Unchanged line (compact)
  if (unchanged.length > 0) {
    console.log();
    const MAX_SHOW = 3;
    const filenames = unchanged.map(p => formatPath.getFilename(p));
    if (unchanged.length <= 6) {
      console.log(chalk.dim(`${unchanged.length} unchanged: ${filenames.join(', ')}`));
    } else {
      const shown = filenames.slice(0, MAX_SHOW).join(', ');
      const remaining = unchanged.length - MAX_SHOW;
      console.log(chalk.dim(`${unchanged.length} unchanged: ${shown}, +${remaining} more`));
    }
  }

  // Summary
  console.log();
  const builtCount = rows.filter(r => r.status === 'built').length;
  const appliedCount = rows.filter(r => r.status === 'applied').length;
  const parts: string[] = [];
  if (builtCount > 0) parts.push(`Built: ${builtCount}`);
  if (appliedCount > 0) parts.push(`Applied: ${appliedCount}`);
  if (unchanged.length > 0) parts.push(`Unchanged: ${unchanged.length}`);
  if (errorCount > 0) parts.push(chalk.red(`Errors: ${errorCount}`));
  if (parts.length > 0) {
    console.log(parts.join('  '));
  }
}
