import { renderResultsTable } from '../ui/resultsTable.js';
import type { RenderContext, RenderResultsOptions, TemplateResult } from '../ui/types.js';
import { formatJsonOutput, writeJson } from './jsonOutput.js';

/**
 * Options for build/apply output. These are the only commands that use
 * the results table with summary.
 */
export interface BatchOutputOptions {
  results: TemplateResult[];
  context: RenderContext & { command: 'build' | 'apply' };
}

/**
 * Output results in either JSON or human-readable format.
 * Branches based on context.json flag.
 *
 * - JSON: Uses writeJson() for clean output (no extra newlines)
 * - Human: Delegates to existing renderResultsTable
 *
 * Note: This function is specifically for build/apply commands.
 * Other commands use their own output mechanisms.
 */
export function output(options: BatchOutputOptions): void {
  const { results, context } = options;

  if (context.json) {
    const jsonOutput = formatJsonOutput(results, context.command);
    writeJson(jsonOutput);
  } else {
    // Cast is safe: BatchOutputOptions is a subset of RenderResultsOptions
    renderResultsTable(options as RenderResultsOptions);
  }
}
