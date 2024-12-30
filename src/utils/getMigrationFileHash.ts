import fs from 'node:fs/promises';
import path from 'node:path';
import { calculateMD5 } from './calculateMD5.js';
import { getConfig } from './config.js';

export async function getMigrationFileHash(
  migrationFile: string,
  baseDir: string
): Promise<string | null> {
  try {
    const config = await getConfig();
    const fullPath = path.join(baseDir, config.migrationDir, migrationFile);
    const content = await fs.readFile(fullPath, 'utf-8');
    return calculateMD5(content);
  } catch {
    return null;
  }
}
