// src/commands/register.ts
import path from 'node:path';
import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import type { TemplateStatus } from '../types.js';
import { createSpinner, renderBranding } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage, isPromptExit } from '../utils/getErrorMessage.js';

async function handleTemplateRegistration(
  templates: string[],
  orchestrator: Orchestrator,
  projectRoot: string
): Promise<number> {
  let successCount = 0;
  let failCount = 0;

  const spinner = createSpinner('Registering templates...').start();

  for (const templatePath of templates) {
    try {
      // Use Orchestrator for registration (single source of truth)
      await orchestrator.registerTemplate(templatePath);
      successCount++;
      const relativePath = path.relative(projectRoot, templatePath);
      spinner.text = `Registered: ${relativePath}`;
      console.log(chalk.green(`✓ Registered template:`), relativePath);
    } catch (err) {
      failCount++;
      spinner.warn(`Failed: ${templatePath} - ${getErrorMessage(err)}`);
    }
  }

  spinner.stop();

  console.log();
  if (successCount > 0) {
    console.log(chalk.green(`${figures.tick} Successfully registered ${successCount} template(s)`));
  }
  if (failCount > 0) {
    console.log(chalk.red(`${figures.cross} Failed to register ${failCount} template(s)`));
  }

  return failCount > 0 ? 1 : 0;
}

export const registerCommand = new Command('register')
  .description('Register templates to track them in the build log')
  .argument('[templates...]', 'Template files to register (optional)')
  .action(async (templateArgs?: string[]) => {
    let exitCode = 0;

    try {
      await renderBranding({ subtitle: 'Register templates' });

      // Initialize Orchestrator and get templates
      const projectRoot = await findProjectRoot();
      const config = await getConfig(projectRoot);
      await using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

      // If templates were provided as arguments, register them directly
      if (templateArgs?.length) {
        // Resolve template paths (may be relative)
        const resolvedPaths = templateArgs.map(t => path.resolve(projectRoot, t));
        exitCode = await handleTemplateRegistration(resolvedPaths, orchestrator, projectRoot);
      } else {
        // Load templates for interactive selection
        const spinner = createSpinner('Loading templates...').start();

        const templatePaths = await orchestrator.findTemplates();
        const templates: TemplateStatus[] = [];

        for (const templatePath of templatePaths) {
          try {
            const template = await orchestrator.getTemplateStatusExternal(templatePath);
            templates.push(template);
          } catch {
            // Skip templates that can't be loaded
          }
        }

        spinner.stop();

        // Filter to unregistered templates by default
        const unregisteredTemplates = templates
          .filter(t => !t.buildState.lastMigrationFile)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (unregisteredTemplates.length === 0) {
          if (templates.length === 0) {
            console.log(chalk.yellow(`${figures.warning} No templates found`));
            console.log(
              chalk.dim(`${figures.info} Start by creating a template in the templates directory.`)
            );
          } else {
            console.log(chalk.yellow(`${figures.warning} No unregistered templates found`));
            console.log(
              chalk.dim(
                `${figures.info} All ${templates.length} template(s) are already registered.`
              )
            );
          }
          exitCode = 0;
        } else if (!process.stdin.isTTY) {
          // Interactive mode requires TTY
          console.log(chalk.red(`${figures.cross} Interactive mode requires a TTY.`));
          console.log(
            chalk.dim('Provide template paths as arguments: srtd register <template1> <template2>')
          );
          exitCode = 1;
        } else {
          // Show interactive multi-select
          const choices = unregisteredTemplates.map(template => ({
            name: `${template.name} (new)`,
            value: template.path,
          }));

          const selectedTemplates = await checkbox({
            message: 'Select templates to register:',
            choices,
          });

          if (selectedTemplates.length === 0) {
            console.log(chalk.yellow(`${figures.warning} No templates selected`));
            exitCode = 0;
          } else {
            exitCode = await handleTemplateRegistration(
              selectedTemplates,
              orchestrator,
              projectRoot
            );
          }
        }
      }
    } catch (error) {
      // Handle Ctrl+C gracefully
      if (isPromptExit(error)) {
        exitCode = 0;
      } else {
        console.log();
        console.log(chalk.red(`${figures.cross} Error loading templates:`));
        console.log(chalk.red(getErrorMessage(error)));
        exitCode = 1;
      }
    }

    // Exit AFTER the await using block has completed, ensuring dispose() runs
    process.exit(exitCode);
  });
