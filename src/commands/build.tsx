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
      description: 'Force building of all templates, irrespective of changes',
      alias: 'f',
    })
  ),
  apply: zod
    .boolean()
    .optional()
    .describe(
      option({
        description: 'Apply the built templates',
        alias: 'a',
      })
    ),
  bundle: zod
    .boolean()
    .optional()
    .describe(
      option({
        description: 'Bundle all templates into a single migration',
        alias: 'b',
      })
    ),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default async function Build({ options }: Props) {
  const term = terminal;

  try {
    // Build subtitle with options
    const forced = options.force ? '(forced)' : '';
    const bundled = options.bundle ? '(bundled)' : '';
    const subtitle = `🏗️  Build migrations ${forced} ${bundled}`.trim();

    // Initialize branding
    const branding = new Branding(term, { subtitle });
    branding.mount();

    // Show loading state
    term('\n');
    term.yellow('⏳ Building templates...\n');

    // Initialize Orchestrator
    const projectRoot = await findProjectRoot();
    const config = await getConfig(projectRoot);
    using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

    // Execute build operation
    const buildResult: ProcessedTemplateResult = await orchestrator.build({
      force: options.force,
      bundle: options.bundle,
      silent: true,
    });

    let result = buildResult;

    // If apply flag is set, also apply the templates
    if (options.apply) {
      term.yellow('⏳ Applying templates...\n');

      const applyResult: ProcessedTemplateResult = await orchestrator.apply({
        force: options.force,
        silent: true,
      });

      // Merge results
      result = {
        errors: [...buildResult.errors, ...applyResult.errors],
        applied: applyResult.applied,
        built: buildResult.built,
        skipped: [...buildResult.skipped, ...applyResult.skipped],
      };
    }

    // Clear loading state and show results
    term.eraseDisplayBelow();
    term.up(1);

    const processingResults = new ProcessingResults(term, {
      result,
      showBuild: true,
      showApply: !!options.apply,
    });
    processingResults.mount();

    // Exit cleanly
    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (error) {
    term('\n');
    term.red('❌ Error building templates:\n');
    term.red(error instanceof Error ? error.message : String(error));
    term('\n');
    process.exit(1);
  }
}
