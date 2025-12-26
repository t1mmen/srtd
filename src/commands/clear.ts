import { select } from '@inquirer/prompts';
import chalk from 'chalk';
// src/commands/clear.ts
import { Command } from 'commander';
import figures from 'figures';
import { Orchestrator } from '../services/Orchestrator.js';
import { createSpinner, renderBranding } from '../ui/index.js';
import { getConfig, resetConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage, isPromptExit } from '../utils/getErrorMessage.js';

const clearOptions = [
  { name: 'Clear local build logs', value: 'local' },
  { name: 'Clear shared build logs', value: 'shared' },
  { name: 'Reset config and logs to initial defaults', value: 'full_reset' },
];

async function handleClearAction(value: string, projectRoot: string): Promise<void> {
  const spinner = createSpinner('Processing...').start();

  try {
    const config = await getConfig(projectRoot);
    using orchestrator = await Orchestrator.create(projectRoot, config, { silent: true });

    switch (value) {
      case 'local':
        await orchestrator.clearBuildLogs('local');
        spinner.succeed('Cleared local build logs');
        break;
      case 'shared':
        await orchestrator.clearBuildLogs('shared');
        spinner.succeed('Cleared shared build logs');
        break;
      case 'full_reset':
        await resetConfig(projectRoot);
        await orchestrator.clearBuildLogs('both');
        spinner.succeed('Reset config and cleared all build logs');
        break;
      default:
        throw new Error('Invalid option');
    }

    console.log(chalk.green(`${figures.tick} Reset complete`));
    process.exit(0);
  } catch (err) {
    spinner.fail('Failed to clear');
    console.log(chalk.red(`${figures.cross} ${getErrorMessage(err)}`));
    process.exit(1);
  }
}

export const clearCommand = new Command('clear')
  .description('Clear build logs or reset configuration')
  .option('--local', 'Clear local build logs (non-interactive)')
  .option('--shared', 'Clear shared build logs (non-interactive)')
  .option('--reset', 'Reset config and logs to initial defaults (non-interactive)')
  .action(async (options: { local?: boolean; shared?: boolean; reset?: boolean }) => {
    try {
      await renderBranding({ subtitle: 'Maintenance' });

      const projectRoot = await findProjectRoot();

      // Non-interactive mode via flags
      if (options.local) {
        await handleClearAction('local', projectRoot);
        return;
      }
      if (options.shared) {
        await handleClearAction('shared', projectRoot);
        return;
      }
      if (options.reset) {
        await handleClearAction('full_reset', projectRoot);
        return;
      }

      // Interactive mode requires TTY
      if (!process.stdin.isTTY) {
        console.log(chalk.red(`${figures.cross} Interactive mode requires a TTY.`));
        console.log(chalk.dim('Use --local, --shared, or --reset flags for non-interactive mode.'));
        process.exit(1);
      }

      // Show interactive selection
      const answer = await select({
        message: 'Select what to clear:',
        choices: clearOptions,
      });

      await handleClearAction(answer, projectRoot);
    } catch (error) {
      // Handle Ctrl+C gracefully
      if (isPromptExit(error)) {
        process.exit(0);
      }

      console.log();
      console.log(chalk.red(`${figures.cross} Error accessing project:`));
      console.log(chalk.red(getErrorMessage(error)));
      process.exit(1);
    }
  });
