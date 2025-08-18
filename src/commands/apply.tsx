// src/commands/apply.tsx
import { option } from 'pastel';
import { terminal } from 'terminal-kit';
import zod from 'zod';
import { Branding } from '../components/Branding.js';
import { ProcessingResults } from '../components/ProcessingResults.js';
import { Orchestrator } from '../services/Orchestrator.js';
import type { ProcessedTemplateResult } from '../types.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';

export const options = zod.object({
  force: zod.boolean().describe(
    option({
      description: 'Force apply of all templates, irrespective of changes',
      alias: 'f',
    })
  ),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default async function Apply({ options }: Props) {
  const term = terminal;

  try {
    // Initialize branding
    const branding = new Branding(term, { subtitle: '▶️  Apply migrations' });
    branding.mount();

    // Show loading state
    term('\n');
    term.yellow('⏳ Applying templates...\n');

    // Initialize Orchestrator
    const projectRoot = await findProjectRoot();
    const config = await getConfig(projectRoot);
    using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

    // Execute apply operation
    const result: ProcessedTemplateResult = await orchestrator.apply({
      force: options.force,
      silent: true,
    });

    // Clear loading state and show results
    term.eraseDisplayBelow();
    term.up(1);

    const processingResults = new ProcessingResults(term, {
      result,
      showApply: true,
    });
    processingResults.mount();

    // Exit cleanly
    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (error) {
    term('\n');
    term.red('❌ Error applying templates:\n');
    term.red(error instanceof Error ? error.message : String(error));
    term('\n');
    process.exit(1);
  }
}
