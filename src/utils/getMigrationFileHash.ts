import fs from 'fs/promises';
import path from 'path';
import { calculateMD5 } from './md5';
import { MIGRATION_DIR } from '../rtsql/rtsql.utils';

export async function getMigrationFileHash(
  migrationFile: string,
  baseDir: string
): Promise<string | null> {
  try {
    const fullPath = path.join(baseDir, MIGRATION_DIR, migrationFile);
    const content = await fs.readFile(fullPath, 'utf-8');
    return calculateMD5(content);
  } catch {
    return null;
  }
}
