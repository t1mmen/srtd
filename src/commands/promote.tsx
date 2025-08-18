// src/commands/promote.tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import figures from 'figures';
import { glob } from 'glob';
import { argument } from 'pastel';
import { terminal } from 'terminal-kit';
import zod from 'zod';
import { Branding } from '../components/Branding.js';
import type { CLIConfig } from '../types.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';

export const args = zod
  .array(zod.string())
  .optional()
  .describe(
    argument({
      name: 'templates',
      description: 'Template files to promote (optional)',
    })
  );

interface Props {
  args?: zod.infer<typeof args>;
}

export default async function Promote({ args: templateArgs }: Props) {
  const term = terminal;

  try {
    // Initialize branding
    const branding = new Branding(term, { subtitle: '🚀 Promote WIP template' });
    branding.mount();

    // Get configuration
    const projectRoot = await findProjectRoot();
    const config = await getConfig(projectRoot);

    // If templates were provided as arguments, promote them directly
    if (templateArgs?.length && templateArgs[0]) {
      await handleTemplatePromotion(templateArgs[0], config, projectRoot, term);
      return;
    }

    // Find WIP templates for interactive selection
    term('\n');
    term.yellow('⏳ Finding WIP templates...\n');

    const wipTemplates = await findWipTemplates(config, projectRoot);

    if (wipTemplates.length === 0) {
      term.yellow(
        `${figures.warning} No WIP templates found in ${config.templateDir} (${config.wipIndicator})\n`
      );
      term('\n');
      term.dim('Press q to quit\n');

      // Set up keyboard input handling
      term.grabInput(true);
      term.on('key', (key: string) => {
        if (key === 'q' || key === 'CTRL_C') {
          term.processExit(0);
        }
      });
      return;
    }

    await showInteractiveSelection(wipTemplates, config, projectRoot, term);
  } catch (error) {
    term('\n');
    term.red('❌ Error promoting template:\n');
    term.red(error instanceof Error ? error.message : String(error));
    term('\n');
    process.exit(1);
  }
}

async function findWipTemplates(config: CLIConfig, projectRoot: string): Promise<string[]> {
  const templatePath = path.join(projectRoot, config.templateDir);
  const pattern = `**/*${config.wipIndicator}*.sql`;
  const matches = await glob(pattern, { cwd: templatePath });
  return matches.map(m => path.join(templatePath, m));
}

async function handleTemplatePromotion(
  templateName: string,
  config: CLIConfig,
  projectRoot: string,
  term: any
): Promise<void> {
  const templateDir = path.join(projectRoot, config.templateDir);
  const pattern = `**/*${templateName}*`;
  const matches = await glob(pattern, { cwd: templateDir });
  const isWip = config.wipIndicator && templateName?.includes(config.wipIndicator);

  if (matches.length === 0 || !isWip) {
    term('\n');
    term.red(
      `${figures.cross} No WIP template found matching: ${templateName} in ${config.templateDir}\n`
    );
    process.exit(1);
  }

  if (!isWip) {
    term('\n');
    term.red(`${figures.cross} Template is not a WIP template: ${templateName}\n`);
    process.exit(1);
  }

  const match = matches[0] ? path.join(templateDir, matches[0]) : '';
  if (!match) {
    term('\n');
    term.red(
      `${figures.cross} No valid match found for template: ${templateName} in ${config.templateDir}\n`
    );
    process.exit(1);
  }

  await promoteTemplate(match, config, projectRoot, term);
}

async function promoteTemplate(
  templatePath: string,
  config: CLIConfig,
  projectRoot: string,
  term: any
): Promise<void> {
  try {
    const newPath = templatePath.replace(config.wipIndicator, '');

    term('\n');
    term.yellow('⏳ Promoting template...\n');

    // Load build log before file operations
    const buildLog = await loadBuildLog(projectRoot, 'local');
    const relOldPath = path.relative(projectRoot, templatePath);
    const relNewPath = path.relative(projectRoot, newPath);

    // Check if source file exists
    await fs.access(templatePath);

    // Rename the file
    await fs.rename(templatePath, newPath);

    // Update build logs if template was tracked
    if (buildLog.templates[relOldPath]) {
      buildLog.templates[relNewPath] = buildLog.templates[relOldPath];
      delete buildLog.templates[relOldPath];
      await saveBuildLog(projectRoot, buildLog, 'local');
    }

    const templateName = path.basename(newPath, '.sql');
    term.green(`${figures.tick} Successfully promoted ${templateName}\n`);
    term.dim('Run `build` command to generate migrations\n');

    process.exit(0);
  } catch (err) {
    term('\n');
    term.red(
      `${figures.cross} Failed to promote template: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}

async function showInteractiveSelection(
  wipTemplates: string[],
  config: CLIConfig,
  projectRoot: string,
  term: any
): Promise<void> {
  let currentIndex = 0;

  function renderScreen() {
    term.clear();

    // Render branding again
    const branding = new Branding(term, { subtitle: '🚀 Promote WIP template' });
    branding.mount();

    term('\n');
    term('Select a template to promote:\n');
    term.dim(`(removes ${config.wipIndicator} in filename)\n\n`);

    wipTemplates.forEach((templatePath, index) => {
      const isCurrent = index === currentIndex;
      const templateName = path.basename(templatePath);

      const prefix = isCurrent ? '▶ ' : '  ';

      if (isCurrent) {
        term.cyan.bold(`${prefix}${templateName}\n`);
      } else {
        term(`${prefix}${templateName}\n`);
      }
    });

    // Controls
    term('\n');
    term.dim('Use arrow keys to navigate, Enter to promote, q to quit\n');
  }

  // Set up keyboard input handling
  term.grabInput();
  term.on('key', async (key: string) => {
    if (key === 'q' || key === 'CTRL_C') {
      term.processExit(0);
    } else if (key === 'UP') {
      currentIndex = Math.max(0, currentIndex - 1);
      renderScreen();
    } else if (key === 'DOWN') {
      currentIndex = Math.min(wipTemplates.length - 1, currentIndex + 1);
      renderScreen();
    } else if (key === 'ENTER') {
      const selectedTemplate = wipTemplates[currentIndex];
      if (selectedTemplate) {
        await promoteTemplate(selectedTemplate, config, projectRoot, term);
      }
    }
  });

  // Initial render
  renderScreen();

  // Keep the process alive
  process.on('SIGINT', () => {
    term.processExit(0);
  });
}
