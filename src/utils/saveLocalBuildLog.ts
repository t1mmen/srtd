import fs from 'fs/promises';
import path from 'path';
import { BuildLog } from '../types';
import { loadConfig } from './config';

export async function saveLocalBuildLog(dirname: string, log: BuildLog): Promise<void> {
  const config = await loadConfig();
  await fs.writeFile(path.resolve(dirname, config.localBuildLog), JSON.stringify(log, null, 2));
}
