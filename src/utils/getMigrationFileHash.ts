import fs from 'fs/promises';
import path from 'path';
import { calculateMD5 } from './md5';
import { loadConfig } from './config';

export async function getMigrationFileHash(
  migrationFile: string,
  baseDir: string
): Promise<string | null> {
  try {
    const config = await loadConfig();
    const fullPath = path.join(baseDir, config.migrationDir, migrationFile);
    const content = await fs.readFile(fullPath, 'utf-8');
    return calculateMD5(content);
  } catch {
    return null;
  }
}
