import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { BuildLog, LocalBuildLog, MigrationError, Template } from './rtsql.types.js';
import glob from 'glob';
import pg from 'pg';
const { Pool } = pg;
import { fileURLToPath } from 'url';

export const TEMPLATE_DIR = 'supabase/migrations-templates';
export const MIGRATION_DIR = 'supabase/migrations';
export const BUILD_LOG = 'supabase/migrations-templates/.buildlog.json';
export const LOCAL_BUILD_LOG = 'supabase/migrations-templates/.buildlog.local.json';
export const PG_CONNECTION = 'postgresql://postgres:postgres@localhost:54322/postgres';

const pool = new Pool({
  connectionString: PG_CONNECTION,
});

export async function calculateMD5(content: string): Promise<string> {
  return crypto.createHash('md5').update(content).digest('hex');
}

export async function loadLocalBuildLog(dirname: string): Promise<LocalBuildLog> {
  try {
    const content = await fs.readFile(path.resolve(dirname, LOCAL_BUILD_LOG), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { templates: {}, lastTimestamp: '' };
  }
}

export async function loadBuildLog(dirname: string): Promise<BuildLog> {
  try {
    const content = await fs.readFile(path.resolve(dirname, BUILD_LOG), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { templates: {}, lastTimestamp: '' };
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

// export function displayHelp(modes: BuildModes): void {
//   console.log(`
//   ${chalk.bold.bgBlue.white(' TIC Migration Template Builder ')}

//   ${chalk.bold('Available Commands:')}
//   ${chalk.cyan('yarn db:build:migrations')}
//     ${
//       modes.force ? chalk.green('▶') : ' '
//     } 🔄 Regular build - Only generates migrations for changed templates

//   ${chalk.cyan('yarn db:build:migrations:watch')}
//     ${
//       modes.skipFiles && modes.apply ? chalk.green('▶') : ' '
//     } 👀 Watches for changes with --apply --skip-files to directly apply changes to local database

//   ${chalk.cyan('yarn db:build:migrations:apply')}
//     ${
//       modes.apply ? chalk.green('▶') : ' '
//     } 🚀 Build & Apply - Generates migrations and (directly) applies them to local DB

//     ${chalk.bold('Flags:')}
//     --filter=pattern ${
//       modes.filter ? chalk.green('✓') : '🎯'
//     } Only process templates matching the pattern
//     --apply          ${
//       modes.apply ? chalk.green('✓') : '📥'
//     } Directly apply migrations to local database
//     --skip-files     ${modes.skipFiles ? chalk.green('✓') : '🏃'} Skip migration file generation
//     --force          ${modes.force ? chalk.green('✓') : '💪'} Force regeneration of all templates
//     --register=file  ${
//       modes.register ? chalk.green('✓') : '📝'
//     } Register template as already applied
//   `);
// }

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
    lastHash: hash,
    lastBuilt: now,
    lastMigration: `registered_${path.basename(templatePath)}`,
  };
  await saveBuildLog(baseDir, buildLog);

  // Update local build log
  const localBuildLog = await loadLocalBuildLog(baseDir);
  localBuildLog.templates[relativePath] = {
    lastApplied: hash,
    lastAppliedDate: now,
  };
  await saveLocalBuildLog(baseDir, localBuildLog);
}

export async function loadTemplates(dirname: string, filter = '**/*.sql'): Promise<Template[]> {
  const baseDir = dirname || path.dirname(fileURLToPath(import.meta.url));
  console.log(baseDir);
  const files = await new Promise<string[]>((resolve, reject) => {
    glob(path.join(baseDir, TEMPLATE_DIR, filter), (err, matches) => {
      if (err) reject(err);
      else resolve(matches);
    });
  });

  const buildLog = await loadBuildLog(dirname);
  // const localBuildLog = await loadLocalBuildLog(dirname);

  const items = await Promise.all(
    files.map(async filePath => {
      const name = path.basename(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = await calculateMD5(content);
      const relativePath = path.relative(dirname, filePath);
      const logEntry = buildLog.templates[relativePath];
      const status: Template['status'] = logEntry?.lastHash
        ? logEntry.lastHash === hash
          ? 'registered'
          : 'modified'
        : 'unregistered';

      return { name, path: filePath, status };
    })
  );

  return items;
}
