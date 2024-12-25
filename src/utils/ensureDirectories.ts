import fs from 'fs/promises';
import path from 'path';
import { loadConfig } from './config';
import { fileExists } from './fileExists';

export async function ensureDirectories(
  baseDir: string
): Promise<{ templateDir: boolean; migrationDir: boolean }> {
  const config = await loadConfig();
  const templatePath = path.join(baseDir, config.templateDir);
  const migrationPath = path.join(baseDir, config.migrationDir);

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
