import fs from 'fs/promises';
import path from 'path';
import { LocalBuildLog } from '../rtsql/rtsql.types';
import { loadConfig } from './config';

export async function loadLocalBuildLog(dirname: string): Promise<LocalBuildLog> {
  try {
    const config = await loadConfig();
    const content = await fs.readFile(path.resolve(dirname, config.localBuildLog), 'utf-8');
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
