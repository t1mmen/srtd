// src/utils/resultTransformer.ts
import type { ProcessedTemplateResult } from '../types.js';
import type { RenderContext, TemplateResult } from '../ui/types.js';
import { isWipTemplate } from './isWipTemplate.js';

export type GetTemplateInfoFn = (name: string) => {
  lastDate?: string;
  migrationFile?: string;
};

export interface TransformOptions {
  wipIndicator?: string;
}

export function toTemplateResults(
  processed: ProcessedTemplateResult,
  getTemplateInfo: GetTemplateInfoFn,
  context: RenderContext,
  options: TransformOptions = {}
): TemplateResult[] {
  const results: TemplateResult[] = [];
  const { wipIndicator = '.wip' } = options;

  // Skipped/unchanged templates (oldest - at top)
  for (const name of processed.skipped) {
    const info = getTemplateInfo(name);
    const isWip = context.command === 'build' && isWipTemplate(name, wipIndicator);
    results.push({
      template: name,
      status: isWip ? 'skipped' : 'unchanged',
      target: context.command === 'build' && !isWip ? info.migrationFile : undefined,
      timestamp: info.lastDate ? new Date(info.lastDate) : undefined,
    });
  }

  // Applied templates (success)
  if (context.command === 'apply') {
    for (const name of processed.applied) {
      results.push({
        template: name,
        status: 'success',
      });
    }
  }

  // Built templates (for build command)
  if (context.command === 'build') {
    for (const name of processed.built) {
      const info = getTemplateInfo(name);
      results.push({
        template: name,
        status: 'success',
        target: info.migrationFile,
      });
    }
  }

  // Errors (newest - at bottom)
  for (const err of processed.errors) {
    results.push({
      template: err.file,
      status: 'error',
      errorMessage: err.error,
      errorHint: err.hint,
    });
  }

  return results;
}
