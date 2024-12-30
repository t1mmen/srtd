import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuildLog } from '../types.js';
import { getConfig } from './config.js';

export async function saveBuildLog(
  dirname: string,
  log: BuildLog,
  which: 'local' | 'common'
): Promise<void> {
  const config = await getConfig();
  const useLog = which === 'local' ? config.localBuildLog : config.buildLog;
  await fs.writeFile(path.resolve(dirname, useLog), JSON.stringify(log, null, 2));
}
