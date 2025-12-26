import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_FILE } from '../constants.js';
import type { CLIConfig } from '../types.js';
import { logger } from './logger.js';

const defaultConfig: CLIConfig = {
  wipIndicator: '.wip',
  migrationPrefix: 'srtd',
  filter: '**/*.sql',
  banner: 'You very likely **DO NOT** want to manually edit this generated file.',
  footer: '',
  wrapInTransaction: true,
  templateDir: 'supabase/migrations-templates',
  migrationDir: 'supabase/migrations',
  buildLog: 'supabase/migrations-templates/.srtd.buildlog.json',
  localBuildLog: 'supabase/migrations-templates/.srtd.buildlog.local.json',
  pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
};

/**
 * Per-directory config cache to support multiple projects in same process
 */
const configCache = new Map<string, CLIConfig>();

/**
 * Get config for a specific directory.
 * Caches per directory to support multi-project scenarios.
 */
export async function getConfig(dir: string = process.cwd()): Promise<CLIConfig> {
  const resolvedDir = path.resolve(dir);

  const cached = configCache.get(resolvedDir);
  if (cached) return cached;

  let config: CLIConfig;
  try {
    const configPath = path.join(resolvedDir, CONFIG_FILE);
    const content = await fs.readFile(configPath, 'utf-8');
    config = { ...defaultConfig, ...JSON.parse(content) };
  } catch {
    config = { ...defaultConfig };
  }

  configCache.set(resolvedDir, config);
  return config;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
  configCache.clear();
}

export async function saveConfig(baseDir: string, config: Partial<CLIConfig>): Promise<void> {
  const resolvedDir = path.resolve(baseDir);
  const configPath = path.join(resolvedDir, CONFIG_FILE);
  const finalConfig = { ...defaultConfig, ...config };
  // Add newline at the end to satisfy linters
  await fs.writeFile(configPath, `${JSON.stringify(finalConfig, null, 2)}\n`).catch(e => {
    logger.error(`Failed to save config: ${e.message}`);
  });
  configCache.set(resolvedDir, finalConfig);
}

export async function resetConfig(baseDir: string): Promise<void> {
  const resolvedDir = path.resolve(baseDir);
  configCache.delete(resolvedDir);
  await fs.unlink(path.join(resolvedDir, CONFIG_FILE)).catch(() => {
    /* ignore */
  });
  await saveConfig(resolvedDir, {});
}
