import { CLIConfig } from '../types';
import path from 'path';
import fs from 'fs/promises';
import { CONFIG_FILE } from '../constants';

let config: CLIConfig;

export async function getConfig(baseDir: string): Promise<CLIConfig> {
  if (!config) {
    config = await loadConfig(baseDir);
  }
  return config;
}

const defaultConfig: CLIConfig = {
  wipIndicator: '.wip',
  banner: '**DO NOT** manually edit this file.',
  footer: '',
  wrapInTransaction: true,
  templateDir: 'supabase/migrations-templates',
  migrationDir: 'supabase/migrations',
  buildLog: 'supabase/migrations-templates/.buildlog.json',
  localBuildLog: 'supabase/migrations-templates/.buildlog.local.json',
  pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
};

export async function loadConfig(dir?: string): Promise<CLIConfig> {
  const baseDir = dir || process.cwd();
  const configPath = path.join(baseDir, CONFIG_FILE);
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content);
    return { ...defaultConfig, ...userConfig };
  } catch {
    return defaultConfig;
  }
}

export async function saveConfig(baseDir: string, config: Partial<CLIConfig>): Promise<void> {
  const configPath = path.join(baseDir, CONFIG_FILE);
  const finalConfig = { ...defaultConfig, ...config };
  await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
}
