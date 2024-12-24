import React from 'react';
import fs from 'fs/promises';
import path from 'path';
import { saveConfig, defaultConfig } from '../utils/config';

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function safeCreate(filepath: string, content: string): Promise<boolean> {
  if (await fileExists(filepath)) {
    return false;
  }
  await fs.writeFile(filepath, content);
  return true;
}

async function createEmptyBuildLog(filepath: string): Promise<boolean> {
  const initial = {
    version: '1.0',
    lastTimestamp: '',
    templates: {},
  };
  return safeCreate(filepath, JSON.stringify(initial, null, 2));
}

async function ensureDirectories(
  baseDir: string
): Promise<{ templateDir: boolean; migrationDir: boolean }> {
  const templatePath = path.join(baseDir, defaultConfig.templateDir);
  const migrationPath = path.join(baseDir, defaultConfig.migrationDir);

  const templateExists = await fileExists(templatePath);
  const migrationExists = await fileExists(migrationPath);

  if (!templateExists) {
    await fs.mkdir(templatePath, { recursive: true });
  }

  if (!migrationExists) {
    await fs.mkdir(migrationPath, { recursive: true });
  }

  return {
    templateDir: !templateExists,
    migrationDir: !migrationExists,
  };
}

export default function Init() {
  React.useEffect(() => {
    async function doInit() {
      try {
        const baseDir = process.cwd();
        const configPath = path.join(baseDir, '.rtsqlrc.json');

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
        const buildLogCreated = await createEmptyBuildLog(
          path.join(baseDir, defaultConfig.buildLog)
        );
        const localBuildLogCreated = await createEmptyBuildLog(
          path.join(baseDir, defaultConfig.localBuildLog)
        );

        if (buildLogCreated) console.log('✅ Created build log');
        if (localBuildLogCreated) console.log('✅ Created local build log');

        // Update gitignore
        const gitignorePath = path.join(baseDir, '.gitignore');
        const ignoreEntry = defaultConfig.localBuildLog;

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
