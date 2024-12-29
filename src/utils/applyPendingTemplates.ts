import { loadTemplates } from './loadTemplates.js';
import { shouldApplyTemplate } from './templateState.js';
import { buildTemplates } from '../lib/buildTemplates.js';

import chalk from 'chalk';

export async function applyPendingTemplates(baseDir: string, filter?: string) {
  // Always load with original filter first
  const templates = await loadTemplates(baseDir, filter);
  const pendingTemplates = await Promise.all(
    templates.map(async t => ({
      template: t,
      shouldApply: await shouldApplyTemplate(t),
    }))
  );

  const templatesNeedingApply = pendingTemplates.filter(t => t.shouldApply);

  if (!templatesNeedingApply.length) {
    console.log(chalk.dim('  💤 No changes to apply'));
    return { errors: [], applied: [] };
  }

  return buildTemplates({
    baseDir,
    // filter: path.basename(template.path),
    apply: true,
    skipFiles: true,
    verbose: true,
  });
}
