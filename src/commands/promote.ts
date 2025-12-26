// src/commands/promote.ts
import path from 'node:path';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { glob } from 'glob';
import { Orchestrator } from '../services/Orchestrator.js';
import type { CLIConfig } from '../types.js';
import { createSpinner, renderBranding } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage, isPromptExit } from '../utils/getErrorMessage.js';

async function findWipTemplates(config: CLIConfig, projectRoot: string): Promise<string[]> {
  const templatePath = path.join(projectRoot, config.templateDir);
  const pattern = `**/*${config.wipIndicator}*.sql`;
  const matches = await glob(pattern, { cwd: templatePath });
  return matches.map(m => path.join(templatePath, m));
}

async function promoteTemplateAction(
  templatePath: string,
  orchestrator: Orchestrator
): Promise<void> {
  const spinner = createSpinner('Promoting template...').start();

  try {
    // Use Orchestrator for promotion (single source of truth)
    const newPath = await orchestrator.promoteTemplate(templatePath);

    const templateName = path.basename(newPath, '.sql');
    spinner.succeed(`Successfully promoted ${templateName}`);
    console.log(chalk.dim('Run `build` command to generate migrations'));

    process.exit(0);
  } catch (err) {
    spinner.fail('Failed to promote template');
    console.log(chalk.red(`${figures.cross} ${getErrorMessage(err)}`));
    process.exit(1);
  }
}

async function handleTemplatePromotion(
  templateName: string,
  config: CLIConfig,
  projectRoot: string,
  orchestrator: Orchestrator
): Promise<void> {
  const templateDir = path.join(projectRoot, config.templateDir);
  const pattern = `**/*${templateName}*`;
  const matches = await glob(pattern, { cwd: templateDir });
  const isWip = config.wipIndicator && templateName?.includes(config.wipIndicator);

  if (matches.length === 0 || !isWip) {
    console.log();
    console.log(
      chalk.red(
        `${figures.cross} No WIP template found matching: ${templateName} in ${config.templateDir}`
      )
    );
    process.exit(1);
  }

  if (!isWip) {
    console.log();
    console.log(chalk.red(`${figures.cross} Template is not a WIP template: ${templateName}`));
    process.exit(1);
  }

  const match = matches[0] ? path.join(templateDir, matches[0]) : '';
  if (!match) {
    console.log();
    console.log(
      chalk.red(
        `${figures.cross} No valid match found for template: ${templateName} in ${config.templateDir}`
      )
    );
    process.exit(1);
  }

  await promoteTemplateAction(match, orchestrator);
}

export const promoteCommand = new Command('promote')
  .description('Promote a WIP template by removing the WIP indicator from its filename')
  .argument('[template]', 'Template file to promote (optional)')
  .action(async (templateArg?: string) => {
    try {
      await renderBranding({ subtitle: 'Promote WIP template' });

      // Get configuration and initialize Orchestrator
      const projectRoot = await findProjectRoot();
      const config = await getConfig(projectRoot);
      using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

      // If template was provided as argument, promote it directly
      if (templateArg) {
        await handleTemplatePromotion(templateArg, config, projectRoot, orchestrator);
        return;
      }

      // Find WIP templates for interactive selection
      const spinner = createSpinner('Finding WIP templates...').start();
      const wipTemplates = await findWipTemplates(config, projectRoot);
      spinner.stop();

      if (wipTemplates.length === 0) {
        console.log(
          chalk.yellow(
            `${figures.warning} No WIP templates found in ${config.templateDir} (${config.wipIndicator})`
          )
        );
        process.exit(0);
      }

      // Interactive mode requires TTY
      if (!process.stdin.isTTY) {
        console.log(chalk.red(`${figures.cross} Interactive mode requires a TTY.`));
        console.log(chalk.dim('Provide a template name as argument: srtd promote <template>'));
        process.exit(1);
      }

      // Show interactive selection
      const choices = wipTemplates.map(templatePath => ({
        name: path.basename(templatePath),
        value: templatePath,
      }));

      const selectedTemplate = await select({
        message: `Select a template to promote (removes ${config.wipIndicator} in filename):`,
        choices,
      });

      await promoteTemplateAction(selectedTemplate, orchestrator);
    } catch (error) {
      // Handle Ctrl+C gracefully
      if (isPromptExit(error)) {
        process.exit(0);
      }

      console.log();
      console.log(chalk.red(`${figures.cross} Error promoting template:`));
      console.log(chalk.red(getErrorMessage(error)));
      process.exit(1);
    }
  });
