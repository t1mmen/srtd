// src/commands/register.tsx
import figures from 'figures';
import { argument } from 'pastel';
import { terminal } from 'terminal-kit';
import zod from 'zod';
import { Branding } from '../components/Branding.js';
import { Orchestrator } from '../services/Orchestrator.js';
import type { TemplateStatus } from '../types.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { registerTemplate } from '../utils/registerTemplate.js';

export const args = zod
  .array(zod.string())
  .optional()
  .describe(
    argument({
      name: 'templates',
      description: 'Template files to register (optional)',
    })
  );

type Props = {
  args: zod.infer<typeof args>;
};

export default async function Register({ args: templateArgs }: Props) {
  const term = terminal;

  try {
    // Initialize branding
    const branding = new Branding(term, { subtitle: '✍️ Register templates' });
    branding.mount();

    // Initialize Orchestrator and get templates
    const projectRoot = await findProjectRoot();
    const config = await getConfig(projectRoot);
    using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

    // If templates were provided as arguments, register them directly
    if (templateArgs?.length) {
      await handleTemplateRegistration(templateArgs, projectRoot, term);
      return;
    }

    // Load templates for interactive selection
    term('\n');
    term.yellow('⏳ Loading templates...\n');

    const templatePaths = await orchestrator.findTemplates();
    const templates: TemplateStatus[] = [];

    for (const templatePath of templatePaths) {
      try {
        const template = await orchestrator.getTemplateStatusExternal(templatePath);
        templates.push(template);
      } catch (error) {
        // Skip templates that can't be loaded
      }
    }

    await showInteractiveSelection(templates, config, term, projectRoot);
  } catch (error) {
    term('\n');
    term.red('❌ Error loading templates:\n');
    term.red(error instanceof Error ? error.message : String(error));
    term('\n');
    process.exit(1);
  }
}

async function handleTemplateRegistration(
  templates: string[],
  projectRoot: string,
  term: any
): Promise<void> {
  let successCount = 0;
  let failCount = 0;

  term('\n');
  term.yellow('⏳ Registering templates...\n');

  for (const templatePath of templates) {
    try {
      await registerTemplate(templatePath, projectRoot);
      successCount++;
      term.green(`${figures.tick} Registered: ${templatePath}\n`);
    } catch (err) {
      failCount++;
      term.red(
        `${figures.cross} Failed: ${templatePath} - ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  term('\n');
  if (successCount > 0) {
    term.green(`${figures.tick} Successfully registered ${successCount} template(s)\n`);
  }
  if (failCount > 0) {
    term.red(`${figures.cross} Failed to register ${failCount} template(s)\n`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

async function showInteractiveSelection(
  templates: TemplateStatus[],
  _config: any,
  term: any,
  projectRoot: string
): Promise<void> {
  let showAll = false;
  let selectedIndices: number[] = [];
  let currentIndex = 0;

  function getFilteredTemplates() {
    return templates
      .filter(t => {
        if (showAll) return true;
        return !t.buildState.lastMigrationFile;
      })
      .sort((a, b) => {
        // If a template has a last migration file, it's considered registered, and sort it last.
        if (a.buildState.lastMigrationFile && !b.buildState.lastMigrationFile) return 1;
        if (!a.buildState.lastMigrationFile && b.buildState.lastMigrationFile) return -1;
        return a.name.localeCompare(b.name);
      });
  }

  function renderScreen() {
    const filteredTemplates = getFilteredTemplates();

    term.clear();

    // Render branding again
    const branding = new Branding(term, { subtitle: '✍️ Register templates' });
    branding.mount();

    term('\n');

    if (filteredTemplates.length === 0) {
      term.yellow(`${figures.warning} No templates ${!showAll ? 'unregistered ' : ''}found\n`);
      if (!showAll && templates.length > 0) {
        term.dim(`${figures.info} Press 'r' to show registered templates\n`);
      }
      if (templates.length === 0) {
        term(`${figures.info} Start by creating a template in the templates directory.\n`);
      }
    } else {
      term(`${selectedIndices.length} / ${filteredTemplates.length} selected\n`);
      term.dim('Use arrow keys to navigate, Space to select, Enter to register, q to quit\n\n');

      filteredTemplates.forEach((template, index) => {
        const isSelected = selectedIndices.includes(index);
        const isCurrent = index === currentIndex;
        const status = template.buildState.lastMigrationFile ? 'registered' : 'new';
        const displayName = `${template.name} (${status})`;

        let prefix = '  ';
        if (isCurrent) {
          prefix = isSelected ? '▶ [✓] ' : '▶ [ ] ';
        } else if (isSelected) {
          prefix = '  [✓] ';
        } else {
          prefix = '  [ ] ';
        }

        if (isCurrent) {
          if (isSelected) {
            term.green.bold(`${prefix}${displayName}\n`);
          } else {
            term.cyan.bold(`${prefix}${displayName}\n`);
          }
        } else if (isSelected) {
          term.green(`${prefix}${displayName}\n`);
        } else {
          term(`${prefix}${displayName}\n`);
        }
      });
    }

    // Controls
    term('\n');
    term.dim('Press ');
    term.bold('q');
    term.dim(' to quit • Press ');
    if (showAll) term.underline('r');
    else term.bold('r');
    term.dim(' to toggle registered templates\n');
  }

  // Set up keyboard input handling
  term.grabInput();
  term.on('key', async (key: string) => {
    const filteredTemplates = getFilteredTemplates();

    if (key === 'q' || key === 'CTRL_C') {
      term.processExit(0);
    } else if (key === 'r') {
      showAll = !showAll;
      currentIndex = 0;
      selectedIndices = [];
      renderScreen();
    } else if (key === 'UP' && filteredTemplates.length > 0) {
      currentIndex = Math.max(0, currentIndex - 1);
      renderScreen();
    } else if (key === 'DOWN' && filteredTemplates.length > 0) {
      currentIndex = Math.min(filteredTemplates.length - 1, currentIndex + 1);
      renderScreen();
    } else if (key === 'SPACE' && filteredTemplates.length > 0) {
      const selectedIndex = selectedIndices.indexOf(currentIndex);
      if (selectedIndex >= 0) {
        selectedIndices.splice(selectedIndex, 1);
      } else {
        selectedIndices.push(currentIndex);
      }
      renderScreen();
    } else if (key === 'ENTER' && selectedIndices.length > 0) {
      const selectedTemplates = selectedIndices
        .map(i => filteredTemplates[i]?.path)
        .filter(Boolean) as string[];
      await handleTemplateRegistration(selectedTemplates, projectRoot, term);
    }
  });

  // Initial render
  renderScreen();

  // Keep the process alive
  process.on('SIGINT', () => {
    term.processExit(0);
  });
}
