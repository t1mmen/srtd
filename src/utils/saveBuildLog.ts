import fs from 'fs/promises';
import path from 'path';
import { BuildLog } from '../rtsql/rtsql.types';
import { BUILD_LOG } from '../rtsql/rtsql.utils';

export async function saveBuildLog(dirname: string, log: BuildLog): Promise<void> {
  await fs.writeFile(path.resolve(dirname, BUILD_LOG), JSON.stringify(log, null, 2));
}
