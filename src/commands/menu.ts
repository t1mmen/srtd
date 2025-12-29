// src/commands/menu.ts
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import figures from 'figures';
import { renderBranding } from '../ui/index.js';
import { getErrorMessage, isPromptExit } from '../utils/getErrorMessage.js';

const menuCommands = [
  { name: 'init      - Initialize srtd in the current project', value: 'init' },
  { name: 'build     - Build migrations from templates', value: 'build' },
  { name: 'apply     - Apply built migrations to the database', value: 'apply' },
  { name: 'watch     - Watch templates for changes and auto-apply', value: 'watch' },
  { name: 'register  - Register templates to track them', value: 'register' },
  { name: 'promote   - Promote a WIP template', value: 'promote' },
  { name: 'clear     - Clear build logs or reset configuration', value: 'clear' },
];

/**
 * Shows the interactive menu and executes the selected command.
 */
export async function showMenu(): Promise<void> {
  try {
    renderBranding();

    const selectedCommand = await select({
      message: 'Select a command:',
      choices: menuCommands,
    });

    // Set flag so commands know they were invoked from menu (skip their header)
    process.env.__SRTD_FROM_MENU__ = 'true';

    // Execute the selected command by dynamically importing it
    // Note: Don't include command name in args - standalone Command already knows its name
    const baseArgs = ['node', 'srtd'];

    try {
      switch (selectedCommand) {
        case 'init': {
          const { initCommand } = await import('./init.js');
          await initCommand.parseAsync(baseArgs);
          break;
        }
        case 'build': {
          const { buildCommand } = await import('./build.js');
          await buildCommand.parseAsync(baseArgs);
          break;
        }
        case 'apply': {
          const { applyCommand } = await import('./apply.js');
          await applyCommand.parseAsync(baseArgs);
          break;
        }
        case 'watch': {
          const { watchCommand } = await import('./watch.js');
          await watchCommand.parseAsync(baseArgs);
          break;
        }
        case 'register': {
          const { registerCommand } = await import('./register.js');
          await registerCommand.parseAsync(baseArgs);
          break;
        }
        case 'promote': {
          const { promoteCommand } = await import('./promote.js');
          await promoteCommand.parseAsync(baseArgs);
          break;
        }
        case 'clear': {
          const { clearCommand } = await import('./clear.js');
          await clearCommand.parseAsync(baseArgs);
          break;
        }
      }
    } finally {
      delete process.env.__SRTD_FROM_MENU__;
    }
  } catch (error) {
    // Handle Ctrl+C gracefully
    if (isPromptExit(error)) {
      process.exit(0);
    }

    console.log();
    console.log(chalk.red(`${figures.cross} Error:`));
    console.log(chalk.red(getErrorMessage(error)));
    process.exit(1);
  }
}
