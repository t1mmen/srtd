// utils/ensureDirectories.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from './fileExists.js';

/**
 * Ensure template and migration directories exist.
 * Creates them if they don't exist.
 *
 * @param baseDir - Base directory for the project
 * @param dirs - Directory paths relative to baseDir (from config)
 * @returns Object indicating which directories were created
 */
export async function ensureDirectories(
  baseDir: string,
  dirs: { templateDir: string; migrationDir: string }
): Promise<{ templateDir: boolean; migrationDir: boolean }> {
  const templatePath = path.join(baseDir, dirs.templateDir);
  const migrationPath = path.join(baseDir, dirs.migrationDir);

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
