import path from 'node:path';
import { fileExists } from './fileExists.js';

async function isProjectDir(dir: string): Promise<boolean> {
  // Check for srtd config files
  if (await fileExists(path.join(dir, 'srtd.config.json'))) return true;

  // Check for package.json
  if (await fileExists(path.join(dir, 'package.json'))) return true;

  // Check for supabase directory
  if (await fileExists(path.join(dir, 'supabase'))) return true;

  return false;
}

export async function findProjectRoot(startDir?: string): Promise<string> {
  let currentDir = startDir || process.cwd();

  while (currentDir !== path.parse(currentDir).root) {
    if (await isProjectDir(currentDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error('Could not find project root. Are you in a Supabase project directory?');
}
