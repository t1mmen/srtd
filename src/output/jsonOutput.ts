import type { RenderContext, TemplateResult, TemplateResultStatus } from '../ui/types.js';

export interface JsonOutputSummary {
  total: number;
  success: number;
  error: number;
  unchanged: number;
  skipped: number;
}

export interface JsonOutput {
  success: boolean;
  command: RenderContext['command'];
  timestamp: string;
  results: TemplateResult[];
  summary: JsonOutputSummary;
}

export function formatJsonOutput(
  results: TemplateResult[],
  command: RenderContext['command']
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
