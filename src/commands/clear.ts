// src/commands/clear.ts
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { type BaseJsonOutput, createBaseJsonOutput, writeJson } from '../output/index.js';
import { Orchestrator } from '../services/Orchestrator.js';
import { createSpinner, renderBranding } from '../ui/index.js';
import { getConfig, resetConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage, isPromptExit } from '../utils/getErrorMessage.js';

interface ClearJsonOutput extends BaseJsonOutput<'clear'> {
  cleared: boolean;
}

function formatClearJsonOutput(success: boolean, error?: string): ClearJsonOutput {
  return {
    ...createBaseJsonOutput('clear', success, error),
    cleared: success,
  };
}

const clearOptions = [
  { name: 'Clear local build logs', value: 'local' },
  { name: 'Clear shared build logs', value: 'shared' },
  { name: 'Reset config and logs to initial defaults', value: 'full_reset' },
];

async function handleClearAction(
  value: string,
  projectRoot: string,
  jsonMode = false
): Promise<{ exitCode: number; error?: string }> {
  const spinner = jsonMode ? null : createSpinner('').start();

  try {
    const { config } = await getConfig(projectRoot);
    await using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

    switch (value) {
      case 'local':
        await orchestrator.clearBuildLogs('local');
        if (spinner) spinner.succeed('Cleared local build logs');
        break;
      case 'shared':
        await orchestrator.clearBuildLogs('shared');
        if (spinner) spinner.succeed('Cleared shared build logs');
        break;
      case 'full_reset':
        await resetConfig(projectRoot);
        await orchestrator.clearBuildLogs('both');
        if (spinner) spinner.succeed('Reset config and cleared all build logs');
        break;
      default:
        throw new Error('Invalid option');
    }

    return { exitCode: 0 };
  } catch (err) {
    const errorMsg = getErrorMessage(err);
    if (spinner) {
      spinner.fail('Failed to clear');
      console.log(chalk.red(`${figures.cross} ${errorMsg}`));
    }
    return { exitCode: 1, error: errorMsg };
  }
}

export const clearCommand = new Command('clear')
  .description('Clear build logs or reset configuration')
  .option('--local', 'Clear local build logs (non-interactive)')
  .option('--shared', 'Clear shared build logs (non-interactive)')
  .option('--reset', 'Reset config and logs to initial defaults (non-interactive)')
  .option('--json', 'Output results as JSON')
  .action(
    async (options: { local?: boolean; shared?: boolean; reset?: boolean; json?: boolean }) => {
      let exitCode = 0;
      let errorMsg: string | undefined;

      try {
        // Skip branding in JSON mode
        if (!options.json) {
          await renderBranding({ subtitle: 'Maintenance' });
        }

        const projectRoot = await findProjectRoot();

        // Non-interactive mode via flags
        if (options.local) {
          const res = await handleClearAction('local', projectRoot, options.json);
          exitCode = res.exitCode;
          errorMsg = res.error;
        } else if (options.shared) {
          const res = await handleClearAction('shared', projectRoot, options.json);
          exitCode = res.exitCode;
          errorMsg = res.error;
        } else if (options.reset) {
          const res = await handleClearAction('full_reset', projectRoot, options.json);
          exitCode = res.exitCode;
          errorMsg = res.error;
        } else if (options.json) {
          // JSON mode requires explicit flag
          errorMsg = 'JSON mode requires --local, --shared, or --reset flag.';
          exitCode = 1;
        } else if (!process.stdin.isTTY) {
          // Interactive mode requires TTY
          console.log(chalk.red(`${figures.cross} Interactive mode requires a TTY.`));
          console.log(
            chalk.dim('Use --local, --shared, or --reset flags for non-interactive mode.')
          );
          exitCode = 1;
        } else {
          // Show interactive selection
          const answer = await select({
            message: 'Select what to clear:',
            choices: clearOptions,
          });

          const res = await handleClearAction(answer, projectRoot);
          exitCode = res.exitCode;
          errorMsg = res.error;
        }

        // Output JSON if in JSON mode
        if (options.json) {
          const jsonOutput = formatClearJsonOutput(exitCode === 0, errorMsg);
          writeJson(jsonOutput);
        }
      } catch (error) {
        // Handle Ctrl+C gracefully
        if (isPromptExit(error)) {
          exitCode = 0;
        } else {
          const errMsg = getErrorMessage(error);
          if (options.json) {
            const jsonOutput = formatClearJsonOutput(false, errMsg);
            writeJson(jsonOutput);
          } else {
            console.log();
            console.log(chalk.red(`${figures.cross} Error accessing project:`));
            console.log(chalk.red(errMsg));
          }
          exitCode = 1;
        }
      }

      // Exit AFTER the await using block has completed, ensuring dispose() runs
      process.exit(exitCode);
    }
  );
