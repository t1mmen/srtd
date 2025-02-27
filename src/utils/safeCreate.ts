import fs from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from './fileExists.js';

export async function safeCreate(filepath: string, content: string): Promise<boolean> {
  // Create directory structure if needed
  const dir = path.dirname(filepath);
  await fs.mkdir(dir, { recursive: true });

  if (await fileExists(filepath)) {
    // If file exists, overwrite it rather than skipping
    await fs.writeFile(filepath, content);
    return true;
  }

  await fs.writeFile(filepath, content);
  return true;
}
