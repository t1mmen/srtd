import fs from 'fs/promises';
import path from 'path';
import { BuildLog } from '../types.js';
import { loadConfig } from './config.js';

export async function loadBuildLog(dirname: string, which: 'local' | 'common'): Promise<BuildLog> {
  try {
    const config = await loadConfig();
    const useType = which === 'local' ? config.localBuildLog : config.buildLog;
    const content = await fs.readFile(path.resolve(dirname, useType), 'utf-8');
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
