// src/commands/init.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { CONFIG_FILE } from '../constants.js';
import type { CLIConfig } from '../types.js';
import { renderBranding } from '../ui/index.js';
import { getConfig, saveConfig } from '../utils/config.js';
import { createEmptyBuildLog } from '../utils/createEmptyBuildLog.js';
import { ensureDirectories } from '../utils/ensureDirectories.js';
import { fileExists } from '../utils/fileExists.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';

interface InitJsonOutput {
  success: boolean;
  command: 'init';
  timestamp: string;
  config?: CLIConfig;
  configPath?: string;
  error?: string;
}

function formatInitJsonOutput(
  success: boolean,
  config?: CLIConfig,
  error?: string
): InitJsonOutput {
  const output: InitJsonOutput = {
    success,
    command: 'init',
    timestamp: new Date().toISOString(),
  };
  if (config) {
    output.config = config;
    output.configPath = CONFIG_FILE;
  }
  if (error) output.error = error;
  return output;
}

export const initCommand = new Command('init')
  .description('Initialize srtd in the current project')
  .option('--json', 'Output results as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      // Skip branding in JSON mode
      if (!options.json) {
        await renderBranding({ subtitle: 'Initialize Project' });
      }

      const baseDir = await findProjectRoot();
      const { config } = await getConfig(baseDir);
      const configPath = path.join(baseDir, CONFIG_FILE);

      // Check and create config file
      if (await fileExists(configPath)) {
        if (!options.json) {
          console.log(chalk.cyan(`${figures.info} ${CONFIG_FILE} already exists`));
        }
      } else {
        await saveConfig(baseDir, {});
        if (!options.json) {
          console.log(
            chalk.green(`${figures.tick} Created ${CONFIG_FILE} with default configuration`)
          );
        }
      }

      // Ensure directories exist
      const dirs = await ensureDirectories(baseDir, {
        templateDir: config.templateDir,
        migrationDir: config.migrationDir,
      });

      if (!options.json) {
        if (dirs.templateDir) {
          console.log(
            chalk.green(`${figures.tick} Created template directory ${config.templateDir}`)
          );
        } else {
          console.log(
            chalk.cyan(`${figures.info} Template directory ${config.templateDir} already exists`)
          );
        }

        if (dirs.migrationDir) {
          console.log(
            chalk.green(`${figures.tick} Created migration directory ${config.migrationDir}`)
          );
        } else {
          console.log(
            chalk.cyan(`${figures.info} Migration directory ${config.migrationDir} already exists`)
          );
        }
      }

      // Create build logs
      const buildLogCreated = await createEmptyBuildLog(path.join(baseDir, config.buildLog));
      const localBuildLogCreated = await createEmptyBuildLog(
        path.join(baseDir, config.localBuildLog)
      );

      if (!options.json) {
        if (buildLogCreated) {
          console.log(chalk.green(`${figures.tick} Created build log at ${config.buildLog}`));
        } else {
          console.log(chalk.cyan(`${figures.info} Build log already exists at ${config.buildLog}`));
        }

        if (localBuildLogCreated) {
          console.log(
            chalk.green(`${figures.tick} Created local build log at ${config.localBuildLog}`)
          );
        } else {
          console.log(
            chalk.cyan(`${figures.info} Local build log already exists at ${config.localBuildLog}`)
          );
        }
      }

      // Update .gitignore
      const gitignorePath = path.join(baseDir, '.gitignore');
      const ignoreEntry = path.basename(config.localBuildLog);

      let content = '';
      try {
        content = await fs.readFile(gitignorePath, 'utf-8');
      } catch {
        // Ignore if file doesn't exist
      }

      if (!content.includes(ignoreEntry)) {
        content = `${content.trim()}\n\n# srtd's local logs should not be committed, as they're per-environment specific\n${ignoreEntry}\n`;
        await fs.writeFile(gitignorePath, content);
        if (!options.json) {
          console.log(chalk.green(`${figures.tick} Added ${ignoreEntry} to .gitignore`));
        }
      } else {
        if (!options.json) {
          console.log(chalk.cyan(`${figures.info} .gitignore already contains ${ignoreEntry}`));
        }
      }

      if (options.json) {
        const jsonOutput = formatInitJsonOutput(true, config);
        process.stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
      } else {
        console.log();
        console.log(chalk.green(`${figures.tick} Initialization complete!`));
        console.log(
          chalk.dim(
            'Your project is ready to use srtd. Start by creating templates in the templates directory.'
          )
        );
      }

      process.exit(0);
    } catch (error) {
      const errMsg = getErrorMessage(error);
      if (options.json) {
        const jsonOutput = formatInitJsonOutput(false, undefined, errMsg);
        process.stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
      } else {
        console.log();
        console.log(chalk.red(`${figures.cross} Failed to initialize: ${errMsg}`));
      }
      process.exit(1);
    }
  });
