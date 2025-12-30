// src/commands/promote.ts
import path from 'node:path';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { glob } from 'glob';
import { type BaseJsonOutput, createBaseJsonOutput, writeJson } from '../output/index.js';
import { Orchestrator } from '../services/Orchestrator.js';
import type { CLIConfig } from '../types.js';
import { createSpinner, renderBranding } from '../ui/index.js';
import { getConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage, isPromptExit } from '../utils/getErrorMessage.js';

interface PromoteJsonOutput extends BaseJsonOutput<'promote'> {
  promoted?: { from: string; to: string };
}

function formatPromoteJsonOutput(
  success: boolean,
  promoted?: { from: string; to: string },
  error?: string
): PromoteJsonOutput {
  return {
    ...createBaseJsonOutput('promote', success, error),
    ...(promoted && { promoted }),
  };
}

async function findWipTemplates(config: CLIConfig, projectRoot: string): Promise<string[]> {
  const templatePath = path.join(projectRoot, config.templateDir);
  const pattern = `**/*${config.wipIndicator}*.sql`;
  const matches = await glob(pattern, { cwd: templatePath });
  return matches.map(m => path.join(templatePath, m));
}

async function promoteTemplateAction(
  templatePath: string,
  orchestrator: Orchestrator,
  jsonMode = false
): Promise<{ exitCode: number; result?: { from: string; to: string }; error?: string }> {
  const spinner = jsonMode ? null : createSpinner('').start();

  try {
    // Use Orchestrator for promotion (single source of truth)
    const newPath = await orchestrator.promoteTemplate(templatePath);

    const templateName = path.basename(newPath, '.sql');
    if (spinner) {
      spinner.succeed(`Successfully promoted ${templateName}`);
      console.log(chalk.dim('Run `build` command to generate migrations'));
    }

    return {
      exitCode: 0,
      result: { from: path.basename(templatePath), to: path.basename(newPath) },
    };
  } catch (err) {
    const errorMsg = getErrorMessage(err);
    if (spinner) {
      spinner.fail('Failed to promote template');
      console.log(chalk.red(`${figures.cross} ${errorMsg}`));
    }
    return { exitCode: 1, error: errorMsg };
  }
}

async function handleTemplatePromotion(
  templateName: string,
  config: CLIConfig,
  projectRoot: string,
  orchestrator: Orchestrator,
  jsonMode = false
): Promise<{ exitCode: number; result?: { from: string; to: string }; error?: string }> {
  const templateDir = path.join(projectRoot, config.templateDir);
  const pattern = `**/*${templateName}*`;
  const matches = await glob(pattern, { cwd: templateDir });
  const isWip = config.wipIndicator && templateName?.includes(config.wipIndicator);

  if (matches.length === 0 || !isWip) {
    const errorMsg = `No WIP template found matching: ${templateName} in ${config.templateDir}`;
    if (!jsonMode) {
      console.log();
      console.log(chalk.red(`${figures.cross} ${errorMsg}`));
    }
    return { exitCode: 1, error: errorMsg };
  }

  if (!isWip) {
    const errorMsg = `Template is not a WIP template: ${templateName}`;
    if (!jsonMode) {
      console.log();
      console.log(chalk.red(`${figures.cross} ${errorMsg}`));
    }
    return { exitCode: 1, error: errorMsg };
  }

  const match = matches[0] ? path.join(templateDir, matches[0]) : '';
  if (!match) {
    const errorMsg = `No valid match found for template: ${templateName} in ${config.templateDir}`;
    if (!jsonMode) {
      console.log();
      console.log(chalk.red(`${figures.cross} ${errorMsg}`));
    }
    return { exitCode: 1, error: errorMsg };
  }

  return promoteTemplateAction(match, orchestrator, jsonMode);
}

export const promoteCommand = new Command('promote')
  .description('Promote a WIP template by removing the WIP indicator from its filename')
  .argument('[template]', 'Template file to promote (optional)')
  .option('--json', 'Output results as JSON')
  .action(async (templateArg: string | undefined, options: { json?: boolean }) => {
    let exitCode = 0;
    let promoteResult: { from: string; to: string } | undefined;
    let errorMsg: string | undefined;

    try {
      // Skip branding in JSON mode
      if (!options.json) {
        await renderBranding({ subtitle: 'Promote WIP template' });
      }

      // Get configuration and initialize Orchestrator
      const projectRoot = await findProjectRoot();
      const { config } = await getConfig(projectRoot);
      await using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

      // If template was provided as argument, promote it directly
      if (templateArg) {
        const res = await handleTemplatePromotion(
          templateArg,
          config,
          projectRoot,
          orchestrator,
          options.json
        );
        exitCode = res.exitCode;
        promoteResult = res.result;
        errorMsg = res.error;
      } else {
        // Find WIP templates for interactive selection
        const wipTemplates = await findWipTemplates(config, projectRoot);

        if (wipTemplates.length === 0) {
          if (!options.json) {
            console.log(
              chalk.yellow(
                `${figures.warning} No WIP templates found in ${config.templateDir} (${config.wipIndicator})`
              )
            );
          }
          exitCode = 0;
        } else if (!process.stdin.isTTY) {
          // Interactive mode requires TTY
          if (!options.json) {
            console.log(chalk.red(`${figures.cross} Interactive mode requires a TTY.`));
            console.log(chalk.dim('Provide a template name as argument: srtd promote <template>'));
          } else {
            errorMsg = 'Interactive mode requires a TTY. Provide a template name as argument.';
          }
          exitCode = 1;
        } else {
          // Show interactive selection
          const choices = wipTemplates.map(templatePath => ({
            name: path.basename(templatePath),
            value: templatePath,
          }));

          const selectedTemplate = await select({
            message: `Select a template to promote (removes ${config.wipIndicator} in filename):`,
            choices,
          });

          const res = await promoteTemplateAction(selectedTemplate, orchestrator, options.json);
          exitCode = res.exitCode;
          promoteResult = res.result;
          errorMsg = res.error;
        }
      }

      // Output JSON if in JSON mode
      if (options.json) {
        const jsonOutput = formatPromoteJsonOutput(
          exitCode === 0 && !errorMsg,
          promoteResult,
          errorMsg
        );
        writeJson(jsonOutput);
      }
    } catch (error) {
      // Handle Ctrl+C gracefully
      if (isPromptExit(error)) {
        exitCode = 0;
      } else {
        const errMsg = getErrorMessage(error);
        if (options.json) {
          const jsonOutput = formatPromoteJsonOutput(false, undefined, errMsg);
          writeJson(jsonOutput);
        } else {
          console.log();
          console.log(chalk.red(`${figures.cross} Error promoting template:`));
          console.log(chalk.red(errMsg));
        }
        exitCode = 1;
      }
    }

    // Exit AFTER the await using block has completed, ensuring dispose() runs
    process.exit(exitCode);
  });
