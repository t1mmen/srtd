import fs from 'fs/promises';
import path from 'path';
import { LocalBuildLog } from '../rtsql/rtsql.types';
import { LOCAL_BUILD_LOG } from '../rtsql/rtsql.utils';

export async function saveLocalBuildLog(dirname: string, log: LocalBuildLog): Promise<void> {
  await fs.writeFile(path.resolve(dirname, LOCAL_BUILD_LOG), JSON.stringify(log, null, 2));
}
