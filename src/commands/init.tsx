import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { useApp } from 'ink';
import React from 'react';
import { CONFIG_FILE } from '../constants.js';
import { getConfig, saveConfig } from '../utils/config.js';
import { createEmptyBuildLog } from '../utils/createEmptyBuildLog.js';
import { ensureDirectories } from '../utils/ensureDirectories.js';
import { fileExists } from '../utils/fileExists.js';
import { logger } from '../utils/logger.js';

export default function Init() {
  const { exit } = useApp();
  React.useEffect(() => {
    async function doInit() {
      console.log(`${chalk.green('\n✨ Initializing srtd\n')}`);
      try {
        const baseDir = process.cwd();
        const config = await getConfig(baseDir);
        const configPath = path.join(baseDir, CONFIG_FILE);

        if (await fileExists(configPath)) {
          logger.skip(`${CONFIG_FILE} already exists`);
        } else {
          await saveConfig(baseDir, {});
          logger.success(`Created ${CONFIG_FILE} with default configuration`);
        }

        const dirs = await ensureDirectories(baseDir);

        if (dirs.templateDir) {
          logger.success(`Created template directory ${config.templateDir}`);
        } else {
          logger.skip(`Template directory ${config.templateDir} already exists`);
        }
        if (dirs.migrationDir) {
          logger.success(`Created migration directory ${config.migrationDir}`);
        } else {
          logger.skip(`Migration directory ${config.migrationDir} already exists`);
        }

        const buildLogCreated = await createEmptyBuildLog(path.join(baseDir, config.buildLog));
        const localBuildLogCreated = await createEmptyBuildLog(
          path.join(baseDir, config.localBuildLog)
        );

        if (buildLogCreated) {
          logger.success(`Created build log at ${config.buildLog}`);
        } else {
          logger.skip(`Build log already exists at ${config.buildLog}`);
        }
        if (localBuildLogCreated) {
          logger.success(`Created local build log at ${config.localBuildLog}`);
        } else {
          logger.skip(`Local build log already exists at ${config.localBuildLog}`);
        }

        const gitignorePath = path.join(baseDir, '.gitignore');
        const ignoreEntry = path.basename(config.localBuildLog);

        let content = '';
        try {
          content = await fs.readFile(gitignorePath, 'utf-8');
        } catch {
          // Ignore
        }

        if (!content.includes(ignoreEntry)) {
          content = `${content.trim()}\n\n# srtd's local logs should not be committed, as they're per-environment specific\n${ignoreEntry}\n`;
          await fs.writeFile(gitignorePath, content);
          logger.success(`Added ${ignoreEntry} to .gitignore`);
        } else {
          logger.skip(`.gitignore already contains ${ignoreEntry}`);
        }
        exit();
      } catch (error) {
        logger.error(`Failed to initialize: ${JSON.stringify(error)}`);
        if (error instanceof Error) {
          exit(error);
        }
      }
    }
    doInit();
  }, [exit]);

  return null;
}
