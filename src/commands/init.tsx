import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { CONFIG_FILE } from '../constants.js';
import { getConfig, saveConfig } from '../utils/config.js';
import { createEmptyBuildLog } from '../utils/createEmptyBuildLog.js';
import { ensureDirectories } from '../utils/ensureDirectories.js';
import { fileExists } from '../utils/fileExists.js';

export default function Init() {
  React.useEffect(() => {
    async function doInit() {
      try {
        const baseDir = process.cwd();
        const config = await getConfig(baseDir);
        const configPath = path.join(baseDir, CONFIG_FILE);

        if (await fileExists(configPath)) {
          console.log(`⏭️ ${CONFIG_FILE} already exists`);
        } else {
          await saveConfig(baseDir, {});
          console.log(`✅ Created ${CONFIG_FILE} with default configuration`);
        }

        const dirs = await ensureDirectories(baseDir);
        if (dirs.templateDir) {
          console.log('✅ Created template directory');
        } else {
          console.log('⏭️ Template directory already exists');
        }
        if (dirs.migrationDir) {
          console.log('✅ Created migration directory');
        } else {
          console.log('⏭️ Migration directory already exists');
        }

        const buildLogCreated = await createEmptyBuildLog(path.join(baseDir, config.buildLog));
        const localBuildLogCreated = await createEmptyBuildLog(
          path.join(baseDir, config.localBuildLog)
        );

        if (buildLogCreated) console.log('✅ Created build log');
        if (localBuildLogCreated) console.log('✅ Created local build log');

        const gitignorePath = path.join(baseDir, '.gitignore');
        const ignoreEntry = config.localBuildLog;

        let content = '';
        try {
          content = await fs.readFile(gitignorePath, 'utf-8');
        } catch {
          // Ignore
        }

        if (!content.includes(ignoreEntry)) {
          content = `${content.trim()}\n${ignoreEntry}\n`;
          await fs.writeFile(gitignorePath, content);
          console.log('✅ Updated .gitignore');
        } else {
          console.log('⏭️ .gitignore already updated');
        }
      } catch (error) {
        console.error('❌ Failed to initialize:', error);
        process.exit(1);
      }
    }
    doInit();
  }, []);

  return null;
}
