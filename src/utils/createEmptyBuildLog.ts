import { BuildLog } from '../types.js';
import { safeCreate } from './safeCreate.js';

export async function createEmptyBuildLog(filepath: string): Promise<boolean> {
  const initial = {
    version: '1.0',
    lastTimestamp: '',
    templates: {},
  } satisfies BuildLog;
  return safeCreate(filepath, JSON.stringify(initial, null, 2));
}
