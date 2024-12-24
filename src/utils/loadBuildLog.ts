import fs from 'fs/promises';
import path from 'path';
import { BuildLog } from '../rtsql/rtsql.types';
import { BUILD_LOG } from '../rtsql/rtsql.utils';

export async function loadBuildLog(dirname: string): Promise<BuildLog> {
  try {
    const content = await fs.readFile(path.resolve(dirname, BUILD_LOG), 'utf-8');
    const log = JSON.parse(content);
    return {
      version: log.version || '1.0',
      lastTimestamp: log.lastTimestamp || '',
      templates: log.templates || {},
    };
  } catch (error) {
    return { version: '1.0', templates: {}, lastTimestamp: '' };
  }
}
