#!/usr/bin/env node
import { Command } from 'commander';
import updateNotifier from 'update-notifier';
import packageJson from '../package.json' with { type: 'json' };

// Check for test environment
const isTestMode = process.env.SRTD_TEST_MODE === 'true';
const nonInteractiveFlag = process.argv.includes('--non-interactive');

// Only show update notifications in non-test mode
if (!isTestMode) {
  updateNotifier({ pkg: packageJson }).notify();
}

import { applyCommand } from './commands/apply.js';
import { buildCommand } from './commands/build.js';
import { clearCommand } from './commands/clear.js';
// Import commands
import { initCommand } from './commands/init.js';
import { showMenu } from './commands/menu.js';
import { promoteCommand } from './commands/promote.js';
import { registerCommand } from './commands/register.js';
import { watchCommand } from './commands/watch.js';

// Create the main program
const program = new Command();

program
  .name('srtd')
  .description('Supabase Repeatable Template Definitions - Live-reloading SQL templates')
  .version(packageJson.version);

// Register all commands
program.addCommand(initCommand);
program.addCommand(applyCommand);
program.addCommand(buildCommand);
program.addCommand(clearCommand);
program.addCommand(promoteCommand);
program.addCommand(registerCommand);
program.addCommand(watchCommand);

// Check if no arguments were provided (flags like --version should still be parsed)
const args = process.argv.slice(2);
const hasArgs = args.length > 0;

// If no args provided and we're in TTY, show interactive menu
if (!hasArgs && process.stdin.isTTY && !isTestMode && !nonInteractiveFlag) {
  await showMenu();
} else {
  // Parse command line arguments (Commander handles --help, --version, and commands)
  await program.parseAsync(process.argv);
}

// For testing purposes, ensure process exits cleanly
if (isTestMode || nonInteractiveFlag) {
  process.exit(0);
}
