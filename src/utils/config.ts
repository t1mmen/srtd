import { RTSQLConfig, RTSQLConfigPartial } from '../types';
import path from 'path';
import fs from 'fs/promises';

let config: RTSQLConfig;

export async function getConfig(baseDir: string): Promise<RTSQLConfig> {
  if (!config) {
    config = await loadConfig(baseDir);
  }
  return config;
}

export const defaultConfig: RTSQLConfig = {
  templateDir: 'supabase/migrations-templates',
  migrationDir: 'supabase/migrations',
  buildLog: 'supabase/migrations-templates/.buildlog.json',
  localBuildLog: 'supabase/migrations-templates/.buildlog.local.json',
  pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
};

export async function loadConfig(dir?: string): Promise<RTSQLConfig> {
  const baseDir = dir || process.cwd();
  const configPath = path.join(baseDir, '.rtsqlrc.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content);
    return { ...defaultConfig, ...userConfig };
  } catch {
    return defaultConfig;
  }
}

export async function saveConfig(baseDir: string, config: RTSQLConfigPartial): Promise<void> {
  const configPath = path.join(baseDir, '.rtsqlrc.json');
  const finalConfig = { ...defaultConfig, ...config };
  await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
}
