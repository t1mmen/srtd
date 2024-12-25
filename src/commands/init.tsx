import React from 'react';
import fs from 'fs/promises';
import path from 'path';
import { saveConfig, loadConfig } from '../utils/config';
import { CONFIG_FILE } from '../constants';
import { createEmptyBuildLog } from '../utils/createEmptyBuildLog';
import { ensureDirectories } from '../utils/ensureDirectories';
import { fileExists } from '../utils/fileExists';

export default function Init() {
  React.useEffect(() => {
    async function doInit() {
      try {
        const config = await loadConfig();
        const baseDir = process.cwd();
        const configPath = path.join(baseDir, CONFIG_FILE);

        // Check/create config
        if (await fileExists(configPath)) {
          console.log('⏭️ Configuration already exists');
        } else {
          await saveConfig(baseDir, {});
          console.log('✅ Created .rtsqlrc.json with default configuration');
        }

        // Create directories
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

        // Create build logs if they don't exist
        const buildLogCreated = await createEmptyBuildLog(path.join(baseDir, config.buildLog));
        const localBuildLogCreated = await createEmptyBuildLog(
          path.join(baseDir, config.localBuildLog)
        );

        if (buildLogCreated) console.log('✅ Created build log');
        if (localBuildLogCreated) console.log('✅ Created local build log');

        // Update gitignore
        const gitignorePath = path.join(baseDir, '.gitignore');
        const ignoreEntry = config.localBuildLog;

        let content = '';
        try {
          content = await fs.readFile(gitignorePath, 'utf-8');
        } catch {
          // Ignore
        }

        if (!content.includes(ignoreEntry)) {
          content = content.trim() + '\n' + ignoreEntry + '\n';
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
