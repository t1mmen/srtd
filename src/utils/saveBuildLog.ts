import fs from 'fs/promises';
import path from 'path';
import { BuildLog } from '../rtsql/rtsql.types';
import { loadConfig } from './config';

export async function saveBuildLog(dirname: string, log: BuildLog): Promise<void> {
  const config = await loadConfig();
  await fs.writeFile(path.resolve(dirname, config.buildLog), JSON.stringify(log, null, 2));
}
