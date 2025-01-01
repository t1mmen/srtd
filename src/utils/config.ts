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
  await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2)).catch(e => {
    logger.error(`Failed to save config: ${e.message}`);
  });
  cachedConfig = finalConfig;
}

export async function resetConfig(baseDir: string): Promise<void> {
  cachedConfig = defaultConfig;
  await fs.unlink(path.join(baseDir, CONFIG_FILE)).catch(() => {
    /* ignore */
  });
  await saveConfig(baseDir, {});
}

export async function clearBuildLogs(
  baseDir: string,
  type: 'local' | 'shared' | 'both'
): Promise<void> {
  const config = cachedConfig || defaultConfig;

  const ops = [];
  if (type === 'local' || type === 'both') {
    ops.push(
      fs.unlink(path.join(baseDir, config.localBuildLog)).catch(() => {
        /* ignore */
      })
    );
  }
  if (type === 'shared' || type === 'both') {
    ops.push(
      fs.unlink(path.join(baseDir, config.buildLog)).catch(() => {
        /* ignore */
      })
    );
  }
  await Promise.all(ops);
}
