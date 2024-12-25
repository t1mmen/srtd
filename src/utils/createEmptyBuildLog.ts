import { BuildLog } from '../types';
import { safeCreate } from './safeCreate';

export async function createEmptyBuildLog(filepath: string): Promise<boolean> {
  const initial = {
    version: '1.0',
    lastTimestamp: '',
    templates: {},
  } satisfies BuildLog;
  return safeCreate(filepath, JSON.stringify(initial, null, 2));
}
