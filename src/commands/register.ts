// src/commands/register.ts
import path from 'node:path';
import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { type BaseJsonOutput, createBaseJsonOutput, writeJson } from '../output/index.js';
import { Orchestrator } from '../services/Orchestrator.js';
import type { TemplateStatus } from '../types.js';
import { renderBranding } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage, isPromptExit } from '../utils/getErrorMessage.js';

interface RegisterResult {
  registered: string[];
  failed: Array<{ file: string; error: string }>;
}

interface RegisterJsonOutput extends BaseJsonOutput<'register'> {
  registered: string[];
  failed: Array<{ file: string; error: string }>;
}

function formatRegisterJsonOutput(result: RegisterResult): RegisterJsonOutput {
  return {
    ...createBaseJsonOutput('register', result.failed.length === 0),
    registered: result.registered,
    failed: result.failed,
  };
}

async function handleTemplateRegistration(
  templates: string[],
  orchestrator: Orchestrator,
  projectRoot: string,
  jsonMode = false
): Promise<{ exitCode: number; result: RegisterResult }> {
  const registered: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  for (const templatePath of templates) {
    try {
      // Use Orchestrator for registration (single source of truth)
      await orchestrator.registerTemplate(templatePath);
      const relativePath = path.relative(projectRoot, templatePath);
      registered.push(relativePath);
      if (!jsonMode) {
        console.log(chalk.green(`${figures.tick} Registered template:`), relativePath);
      }
    } catch (err) {
      const relativePath = path.relative(projectRoot, templatePath);
      failed.push({ file: relativePath, error: getErrorMessage(err) });
      if (!jsonMode) {
        console.log(
          chalk.yellow(`${figures.warning} Failed: ${templatePath} - ${getErrorMessage(err)}`)
        );
      }
    }
  }

  if (!jsonMode) {
    console.log();
    if (registered.length > 0) {
      console.log(
        chalk.green(`${figures.tick} Successfully registered ${registered.length} template(s)`)
      );
    }
    if (failed.length > 0) {
      console.log(chalk.red(`${figures.cross} Failed to register ${failed.length} template(s)`));
    }
  }

  return {
    exitCode: failed.length > 0 ? 1 : 0,
    result: { registered, failed },
  };
}

export const registerCommand = new Command('register')
  .description('Register templates to track them in the build log')
  .argument('[templates...]', 'Template files to register (optional)')
  .option('--json', 'Output results as JSON')
  .action(async (templateArgs: string[] | undefined, options: { json?: boolean }) => {
    let exitCode = 0;
    let result: RegisterResult = { registered: [], failed: [] };

    try {
      // Skip branding in JSON mode
      if (!options.json) {
        await renderBranding({ subtitle: 'Register templates' });
      }

      // Initialize Orchestrator and get templates
      const projectRoot = await findProjectRoot();
      const { config } = await getConfig(projectRoot);
      await using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

      // If templates were provided as arguments, register them directly
      if (templateArgs?.length) {
        // Resolve template paths (may be relative)
        const resolvedPaths = templateArgs.map(t => path.resolve(projectRoot, t));
        const res = await handleTemplateRegistration(
          resolvedPaths,
          orchestrator,
          projectRoot,
          options.json
        );
        exitCode = res.exitCode;
        result = res.result;
      } else {
        // In JSON mode without templates, return empty result
        if (options.json) {
          result = { registered: [], failed: [] };
          exitCode = 0;
        } else {
          // Load templates for interactive selection
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

          // Filter to unregistered templates by default
          const unregisteredTemplates = templates
            .filter(t => !t.buildState.lastMigrationFile)
            .sort((a, b) => a.name.localeCompare(b.name));

          if (unregisteredTemplates.length === 0) {
            if (templates.length === 0) {
              console.log(chalk.yellow(`${figures.warning} No templates found`));
              console.log(
                chalk.dim(
                  `${figures.info} Start by creating a template in the templates directory.`
                )
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
              chalk.dim(
                'Provide template paths as arguments: srtd register <template1> <template2>'
              )
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
              const res = await handleTemplateRegistration(
                selectedTemplates,
                orchestrator,
                projectRoot
              );
              exitCode = res.exitCode;
              result = res.result;
            }
          }
        }
      }

      // Output JSON if in JSON mode
      if (options.json) {
        const jsonOutput = formatRegisterJsonOutput(result);
        writeJson(jsonOutput);
      }
    } catch (error) {
      // Handle Ctrl+C gracefully
      if (isPromptExit(error)) {
        exitCode = 0;
      } else {
        if (options.json) {
          const jsonOutput = formatRegisterJsonOutput({
            registered: [],
            failed: [{ file: '', error: getErrorMessage(error) }],
          });
          writeJson(jsonOutput);
        } else {
          console.log();
          console.log(chalk.red(`${figures.cross} Error loading templates:`));
          console.log(chalk.red(getErrorMessage(error)));
        }
        exitCode = 1;
      }
    }

    // Exit AFTER the await using block has completed, ensuring dispose() runs
    process.exit(exitCode);
  });
