import { renderResultsTable } from '../ui/resultsTable.js';
import type { RenderResultsOptions } from '../ui/types.js';
import { formatJsonOutput } from './jsonOutput.js';

/**
 * Output results in either JSON or human-readable format.
 * Branches based on context.json flag.
 *
 * - JSON: Uses process.stdout.write() for clean output (no extra newlines)
 * - Human: Delegates to existing renderResultsTable
 */
export function output(options: RenderResultsOptions): void {
  const { results, context } = options;

  if (context.json) {
    const jsonOutput = formatJsonOutput(results, context.command);
    process.stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
  } else {
    renderResultsTable(options);
  }
}
