import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_FILE } from '../constants.js';
import type { CLIConfig } from '../types.js';
import { logger } from './logger.js';
import { CLIConfigSchema } from './schemas.js';

/**
 * Warning type for config validation issues
 */
export interface ValidationWarning {
  type: 'parse' | 'validation';
  message: string;
  path?: string;
}

/**
 * Module-level array to track config validation warnings
 */
let configWarnings: ValidationWarning[] = [];

/**
 * Get all recorded config validation warnings
 */
export function getConfigWarnings(): ValidationWarning[] {
  return [...configWarnings];
}

/**
 * Clear all recorded config validation warnings (useful for testing)
 */
export function clearConfigWarnings(): void {
  configWarnings = [];
}

const defaultConfig: CLIConfig = {
  wipIndicator: '.wip',
  migrationPrefix: 'srtd',
  migrationFilename: '$timestamp_$prefix$migrationName.sql',
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
 * Validates config with Zod schema, falling back to defaults on errors.
 */
export async function getConfig(dir: string = process.cwd()): Promise<CLIConfig> {
  const resolvedDir = path.resolve(dir);

  const cached = configCache.get(resolvedDir);
  if (cached) return cached;

  let config: CLIConfig;
  try {
    const configPath = path.join(resolvedDir, CONFIG_FILE);
    const content = await fs.readFile(configPath, 'utf-8');

    // Parse JSON first
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      const errorMsg = `Invalid JSON in config file: ${parseError instanceof Error ? parseError.message : 'Parse error'}`;
      logger.warn(errorMsg);
      configWarnings.push({
        type: 'parse',
        message: errorMsg,
        path: configPath,
      });
      config = { ...defaultConfig };
      configCache.set(resolvedDir, config);
      return config;
    }

    // Merge with defaults first, then validate the merged result
    const merged = { ...defaultConfig, ...(parsed as Record<string, unknown>) };

    // Validate the merged config
    const validationResult = CLIConfigSchema.safeParse(merged);

    if (!validationResult.success) {
      // Format error message
      const errors = validationResult.error.issues
        .map(issue => {
          const fieldPath = issue.path.join('.');
          return fieldPath ? `${fieldPath}: ${issue.message}` : issue.message;
        })
        .join('; ');

      const errorMsg = `Invalid config schema: ${errors}`;
      logger.warn(errorMsg);
      configWarnings.push({
        type: 'validation',
        message: errorMsg,
        path: configPath,
      });
      config = { ...defaultConfig };
    } else {
      config = validationResult.data as CLIConfig;
    }
  } catch {
    // File not found or other read error - use defaults silently
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
