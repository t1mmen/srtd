import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_FILE } from '../constants.js';
import type { CLIConfig } from '../types.js';

const defaultConfig: CLIConfig = {
  wipIndicator: '.wip',
  filter: '**/*.sql',
  banner: 'You very likely **DO NOT** want to manually edit this generated file.',
  footer: '',
  wrapInTransaction: true,
  templateDir: 'supabase/migrations-templates',
  migrationDir: 'supabase/migrations',
  buildLog: 'supabase/migrations-templates/.buildlog.json',
  localBuildLog: 'supabase/migrations-templates/.buildlog.local.json',
  pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
};

let cachedConfig: CLIConfig | undefined;

export async function getConfig(dir: string = process.cwd()): Promise<CLIConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const configPath = path.join(dir, CONFIG_FILE);
    const content = await fs.readFile(configPath, 'utf-8');
    cachedConfig = { ...defaultConfig, ...JSON.parse(content) };
  } catch {
    cachedConfig = defaultConfig;
  }

  if (!cachedConfig) {
    throw new Error('Config not initialized');
  }
  return cachedConfig;
}

export async function saveConfig(baseDir: string, config: Partial<CLIConfig>): Promise<void> {
  const configPath = path.join(baseDir, CONFIG_FILE);
  const finalConfig = { ...defaultConfig, ...config };
  await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
  cachedConfig = finalConfig;
}

// import { CLIConfig } from '../types.js';
// import path from 'path';
// import fs from 'fs/promises';
// import { CONFIG_FILE } from '../constants.js';

// let config: CLIConfig;

// export async function getConfig(baseDir: string): Promise<CLIConfig> {
//   if (!config) {
//     config = await getConfig(baseDir);
//   }
//   return config;
// }

// const defaultConfig: CLIConfig = {
//   wipIndicator: '.wip',
//   filter: '**/*.sql',
//   banner: 'You very likely **DO NOT** want to manually edit this generated file.',
//   footer: '',
//   wrapInTransaction: true,
//   templateDir: 'supabase/migrations-templates',
//   migrationDir: 'supabase/migrations',
//   buildLog: 'supabase/migrations-templates/.buildlog.json',
//   localBuildLog: 'supabase/migrations-templates/.buildlog.local.json',
//   pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
// };

// export async function getConfig(dir?: string): Promise<CLIConfig> {
//   const baseDir = dir || process.cwd();
//   const configPath = path.join(baseDir, CONFIG_FILE);
//   try {
//     const content = await fs.readFile(configPath, 'utf-8');
//     const userConfig = JSON.parse(content);
//     return { ...defaultConfig, ...userConfig };
//   } catch {
//     return defaultConfig;
//   }
// }

// export async function saveConfig(baseDir: string, config: Partial<CLIConfig>): Promise<void> {
//   const configPath = path.join(baseDir, CONFIG_FILE);
//   const finalConfig = { ...defaultConfig, ...config };
//   await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
// }
