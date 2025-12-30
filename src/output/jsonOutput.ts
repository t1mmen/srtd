import type { RenderContext, TemplateResult, TemplateResultStatus } from '../ui/types.js';

/**
 * Base envelope for all JSON command output.
 * All command-specific outputs extend this interface.
 */
export interface BaseJsonOutput<
  TCommand extends RenderContext['command'] = RenderContext['command'],
> {
  success: boolean;
  command: TCommand;
  timestamp: string;
  error?: string;
}

/**
 * Create the base JSON output envelope.
 * Used by all commands for consistent structure.
 */
export function createBaseJsonOutput<TCommand extends RenderContext['command']>(
  command: TCommand,
  success: boolean,
  error?: string
): BaseJsonOutput<TCommand> {
  const output: BaseJsonOutput<TCommand> = {
    success,
    command,
    timestamp: new Date().toISOString(),
  };
  if (error) output.error = error;
  return output;
}

/**
 * Write a JSON object to stdout with pretty formatting and trailing newline.
 * Centralized helper to ensure consistent JSON output across all commands.
 */
export function writeJson(output: unknown): void {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

/**
 * Format a fatal error response for batch commands (build/apply).
 * Used in catch blocks when the entire operation fails before processing templates.
 */
export function formatFatalError(command: 'build' | 'apply', error: string): JsonOutput {
  return {
    success: false,
    command,
    timestamp: new Date().toISOString(),
    error,
    results: [],
    summary: { total: 0, success: 0, error: 1, unchanged: 0, skipped: 0 },
  };
}

export interface JsonOutputSummary {
  total: number;
  success: number;
  error: number;
  unchanged: number;
  skipped: number;
}

export interface JsonOutput extends BaseJsonOutput<'build' | 'apply'> {
  results: TemplateResult[];
  summary: JsonOutputSummary;
}

export function formatJsonOutput(
  results: TemplateResult[],
  command: 'build' | 'apply'
): JsonOutput {
  const countByStatus = (status: TemplateResultStatus): number =>
    results.filter(r => r.status === status).length;

  // Count 'built' as success too (per plan requirement)
  const successCount = countByStatus('success') + countByStatus('built');
  const errorCount = countByStatus('error');

  return {
    success: errorCount === 0,
    command,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      success: successCount,
      error: errorCount,
      unchanged: countByStatus('unchanged'),
      skipped: countByStatus('skipped'),
    },
  };
}
