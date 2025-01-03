import fs from 'node:fs/promises';
import { fileExists } from './fileExists.js';

export async function safeCreate(filepath: string, content: string): Promise<boolean> {
  if (await fileExists(filepath)) {
    return false;
  }
  await fs.writeFile(filepath, content);
  return true;
}
