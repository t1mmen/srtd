import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_FILE, DEFAULT_PG_CONNECTION } from '../constants.js';
import type { CLIConfig } from '../types.js';
import { fileExists } from './fileExists.js';
import { logger } from './logger.js';
import { CLIConfigSchema, formatZodErrors, type ValidationWarning } from './schemas.js';

/**
 * Result type for getConfig - includes config and any validation warnings
 */
export interface ConfigResult {
  config: CLIConfig;
  warnings: ValidationWarning[];
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
  pgConnection: DEFAULT_PG_CONNECTION,
};

/**
 * Per-directory config cache to support multiple projects in same process
 * Caches both config and warnings together
 */
const configCache = new Map<string, ConfigResult>();

/**
 * Get config for a specific directory.
 * Caches per directory to support multi-project scenarios.
 * Validates config with Zod schema, falling back to defaults on errors.
 * Returns both config and any validation warnings encountered.
 */
export async function getConfig(dir: string = process.cwd()): Promise<ConfigResult> {
  const resolvedDir = path.resolve(dir);

  const cached = configCache.get(resolvedDir);
  if (cached) return cached;

  let config: CLIConfig;
  const warnings: ValidationWarning[] = [];

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
      warnings.push({
        source: 'config',
        type: 'parse',
        message: errorMsg,
        path: configPath,
      });
      config = { ...defaultConfig };
      const result = { config, warnings };
      configCache.set(resolvedDir, result);
      return result;
    }

    // Merge with defaults first, then validate the merged result
    const merged = { ...defaultConfig, ...(parsed as Record<string, unknown>) };

    // Validate the merged config
    const validationResult = CLIConfigSchema.safeParse(merged);

    if (!validationResult.success) {
      const errorMsg = `Invalid config schema: ${formatZodErrors(validationResult.error)}`;
      logger.warn(errorMsg);
      warnings.push({
        source: 'config',
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

  // Check if template directory exists
  const templateDirPath = path.join(resolvedDir, config.templateDir);
  const templateDirExists = await fileExists(templateDirPath);
  if (!templateDirExists) {
    warnings.push({
      source: 'config',
      type: 'missing',
      message: `Template directory does not exist: ${config.templateDir}`,
      path: templateDirPath,
    });
  }

  const result = { config, warnings };
  configCache.set(resolvedDir, result);
  return result;
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
  configCache.set(resolvedDir, { config: finalConfig, warnings: [] });
}

export async function resetConfig(baseDir: string): Promise<void> {
  const resolvedDir = path.resolve(baseDir);
  configCache.delete(resolvedDir);
  await fs.unlink(path.join(resolvedDir, CONFIG_FILE)).catch(() => {
    /* ignore */
  });
  await saveConfig(resolvedDir, {});
}
