import fs from 'fs/promises';
import path from 'path';
import { BuildLog } from '../types';
import { loadConfig } from './config';

export async function loadBuildLog(dirname: string): Promise<BuildLog> {
  try {
    const config = await loadConfig();
    const content = await fs.readFile(path.resolve(dirname, config.buildLog), 'utf-8');
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
