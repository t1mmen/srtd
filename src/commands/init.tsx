// src/commands/init.tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import figures from 'figures';
import { terminal } from 'terminal-kit';
import { Branding } from '../components/Branding.js';
import { CONFIG_FILE } from '../constants.js';
import { getConfig, saveConfig } from '../utils/config.js';
import { createEmptyBuildLog } from '../utils/createEmptyBuildLog.js';
import { ensureDirectories } from '../utils/ensureDirectories.js';
import { fileExists } from '../utils/fileExists.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';

export default async function Init() {
  const term = terminal;

  try {
    // Initialize branding
    const branding = new Branding(term, { subtitle: '✨ Initialize Project' });
    branding.mount();

    term('\n');
    term.yellow('⏳ Initializing srtd...\n');

    const baseDir = await findProjectRoot();
    const config = await getConfig(baseDir);
    const configPath = path.join(baseDir, CONFIG_FILE);

    // Check and create config file
    if (await fileExists(configPath)) {
      term.cyan(`${figures.info} ${CONFIG_FILE} already exists\n`);
    } else {
      await saveConfig(baseDir, {});
      term.green(`${figures.tick} Created ${CONFIG_FILE} with default configuration\n`);
    }

    // Ensure directories exist
    const dirs = await ensureDirectories(baseDir);

    if (dirs.templateDir) {
      term.green(`${figures.tick} Created template directory ${config.templateDir}\n`);
    } else {
      term.cyan(`${figures.info} Template directory ${config.templateDir} already exists\n`);
    }

    if (dirs.migrationDir) {
      term.green(`${figures.tick} Created migration directory ${config.migrationDir}\n`);
    } else {
      term.cyan(`${figures.info} Migration directory ${config.migrationDir} already exists\n`);
    }

    // Create build logs
    const buildLogCreated = await createEmptyBuildLog(path.join(baseDir, config.buildLog));
    const localBuildLogCreated = await createEmptyBuildLog(
      path.join(baseDir, config.localBuildLog)
    );

    if (buildLogCreated) {
      term.green(`${figures.tick} Created build log at ${config.buildLog}\n`);
    } else {
      term.cyan(`${figures.info} Build log already exists at ${config.buildLog}\n`);
    }

    if (localBuildLogCreated) {
      term.green(`${figures.tick} Created local build log at ${config.localBuildLog}\n`);
    } else {
      term.cyan(`${figures.info} Local build log already exists at ${config.localBuildLog}\n`);
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
      term.green(`${figures.tick} Added ${ignoreEntry} to .gitignore\n`);
    } else {
      term.cyan(`${figures.info} .gitignore already contains ${ignoreEntry}\n`);
    }

    term('\n');
    term.green(`${figures.tick} Initialization complete!\n`);
    term.dim(
      'Your project is ready to use srtd. Start by creating templates in the templates directory.\n'
    );

    process.exit(0);
  } catch (error) {
    term('\n');
    term.red(
      `${figures.cross} Failed to initialize: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}
