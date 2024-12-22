import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import {
  BuildLog,
  LocalBuildLog,
  MigrationError,
  RTSQLConfig,
  TemplateStatus,
} from './rtsql.types.js';
import glob from 'glob';
import pg from 'pg';
import { loadConfig } from './config';
const { Pool } = pg;

export const TEMPLATE_DIR = 'supabase/migrations-templates';
export const MIGRATION_DIR = 'supabase/migrations';
export const BUILD_LOG = 'supabase/migrations-templates/.buildlog.json';
export const LOCAL_BUILD_LOG = 'supabase/migrations-templates/.buildlog.local.json';
export const PG_CONNECTION = 'postgresql://postgres:postgres@localhost:54322/postgres';

const pool = new Pool({
  connectionString: PG_CONNECTION,
});

let config: RTSQLConfig;

export async function getConfig(baseDir: string): Promise<RTSQLConfig> {
  if (!config) {
    config = await loadConfig(baseDir);
  }
  return config;
}

export async function calculateMD5(content: string): Promise<string> {
  return crypto.createHash('md5').update(content).digest('hex');
}

export async function loadLocalBuildLog(dirname: string): Promise<LocalBuildLog> {
  try {
    const content = await fs.readFile(path.resolve(dirname, LOCAL_BUILD_LOG), 'utf-8');
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

export async function loadBuildLog(dirname: string): Promise<BuildLog> {
  try {
    const content = await fs.readFile(path.resolve(dirname, BUILD_LOG), 'utf-8');
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

export function isWipTemplate(templatePath: string): boolean {
  return templatePath.includes('.wip.');
}

export async function saveBuildLog(dirname: string, log: BuildLog): Promise<void> {
  await fs.writeFile(path.resolve(dirname, BUILD_LOG), JSON.stringify(log, null, 2));
}

export async function saveLocalBuildLog(dirname: string, log: LocalBuildLog): Promise<void> {
  await fs.writeFile(path.resolve(dirname, LOCAL_BUILD_LOG), JSON.stringify(log, null, 2));
}

export async function getNextTimestamp(buildLog: BuildLog): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);

  if (timestamp <= buildLog.lastTimestamp) {
    const nextTimestamp = (BigInt(buildLog.lastTimestamp) + 1n).toString();
    buildLog.lastTimestamp = nextTimestamp;
    return nextTimestamp;
  }

  buildLog.lastTimestamp = timestamp;
  return timestamp;
}

async function connect() {
  const client = await pool.connect().catch(error => {
    console.error(`  ❌ ${chalk.red('Failed to connect to database')}`);
    console.error(error);
    process.exit(1);
  });
  return client;
}

export async function applyMigration(
  content: string,
  templateName: string
): Promise<true | MigrationError> {
  const client = await connect();
  try {
    await client.query('BEGIN');

    // Create advisory lock
    const lockKey = Math.abs(Buffer.from(templateName).reduce((acc, byte) => acc + byte, 0));
    await client.query(`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);

    await client.query(content);

    await client.query('COMMIT');

    console.log(`  ✅ ${chalk.green('Applied successfully')}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.log(`  ❌ ${chalk.red('Failed to apply:')} ${error}`);
    return {
      file: templateName,
      error: error as string,
      templateName,
    };
  } finally {
    client.release();
  }
}

// Cleanup on process exit
process.on('exit', () => {
  pool.end();
});

// Add new function to display error summary
export function displayErrorSummary(errors: MigrationError[]): void {
  if (errors.length === 0) return;

  console.log('\n  ❌ Error Summary:');
  console.log('  ================');
  errors.forEach(({ templateName, error }) => {
    console.log(`\n  Failed migration: ${chalk.red(templateName)}`);
    console.log(`  ${error.split('\n').join('\n  ')}`);
  });
  console.log('\n  ⚠️  Some migrations failed. Please check the errors above.');
}

export function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export async function registerTemplate(templatePath: string, baseDir: string) {
  const content = await fs.readFile(templatePath, 'utf-8');
  const hash = await calculateMD5(content);
  const relativePath = path.relative(baseDir, templatePath);
  const now = new Date().toISOString();

  // Update build log
  const buildLog = await loadBuildLog(baseDir);
  buildLog.templates[relativePath] = {
    lastBuildHash: hash,
    lastBuildDate: now,
    lastMigrationFile: `registered_${path.basename(templatePath)}`,
  };
  await saveBuildLog(baseDir, buildLog);

  // Update local build log
  const localBuildLog = await loadLocalBuildLog(baseDir);
  localBuildLog.templates[relativePath] = {
    lastAppliedHash: hash,
    lastAppliedDate: now,
  };
  await saveLocalBuildLog(baseDir, localBuildLog);
}

export async function getMigrationFileHash(
  migrationFile: string,
  baseDir: string
): Promise<string | null> {
  try {
    const fullPath = path.join(baseDir, MIGRATION_DIR, migrationFile);
    const content = await fs.readFile(fullPath, 'utf-8');
    return calculateMD5(content);
  } catch {
    return null;
  }
}

export async function loadTemplates(
  dirname: string,
  filter = '**/*.sql'
): Promise<TemplateStatus[]> {
  const config = await getConfig(dirname);
  const templatePath = path.join(dirname, config.templateDir, filter);
  const templates = await new Promise<string[]>((resolve, reject) => {
    glob(templatePath, (err, matches) => {
      if (err) reject(err);
      else resolve(matches);
    });
  });

  const buildLog = await loadBuildLog(dirname);

  const results: TemplateStatus[] = [];

  for (const templatePath of templates) {
    const content = await fs.readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);
    const relPath = path.relative(dirname, templatePath);
    const buildState = buildLog.templates[relPath] || {};

    // Get hash from migration file if it exists
    const migrationHash = buildState.lastMigrationFile
      ? await getMigrationFileHash(buildState.lastMigrationFile, dirname)
      : null;

    results.push({
      name: path.basename(templatePath, '.sql'),
      path: templatePath,
      currentHash,
      migrationHash,
      buildState,
    });
  }

  return results;
}
