import crypto from 'crypto';
import fs, { readFile } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { BuildLog, BuildModes, LocalBuildLog, MigrationError } from './rtsql.types.js';

export const execAsync = promisify(exec);
import { execa } from 'execa';

export const TEMPLATE_DIR = '../../supabase/migrations-templates';
export const MIGRATION_DIR = '../../supabase/migrations';
export const BUILD_LOG = '../../supabase/migrations-templates/.buildlog.json';
export const LOCAL_BUILD_LOG = '../../supabase/migrations-templates/.buildlog.local.json';
export const PG_CONNECTION = 'postgresql://postgres:postgres@localhost:54322/postgres';

export async function calculateMD5(content: string): Promise<string> {
  return crypto.createHash('md5').update(content).digest('hex');
}

export async function loadLocalBuildLog(dirname: string): Promise<LocalBuildLog> {
  try {
    const content = await fs.readFile(path.resolve(dirname, LOCAL_BUILD_LOG), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { templates: {} };
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

export async function applyMigration(
  filePath: string,
  templateName: string
): Promise<MigrationError | true> {
  try {
    await execa('psql', [PG_CONNECTION, '-v', 'ON_ERROR_STOP=1', '-f', filePath]);
    console.log(`  ✨ Successfully applied: ${path.basename(filePath)}`);
    return true;
  } catch (error: any) {
    const errorDetails = error.stderr || error.stdout || error.message;
    console.error(`  ❌ Failed to apply migration: ${path.basename(filePath)}`);
    console.error(`     Error: ${errorDetails}`);
    return {
      file: path.basename(filePath),
      error: errorDetails,
      templateName,
    };
  } finally {
    await fs.unlink(filePath).catch(() => {
      // Ignore cleanup errors
    });
  }
}

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

export function displayHelp(modes: BuildModes): void {
  console.log(`
  ${chalk.bold.bgBlue.white(' TIC Migration Template Builder ')}

  ${chalk.bold('Available Commands:')}
  ${chalk.cyan('yarn db:build:migrations')}
    ${
      modes.force ? chalk.green('▶') : ' '
    } 🔄 Regular build - Only generates migrations for changed templates

  ${chalk.cyan('yarn db:build:migrations:watch')}
    ${
      modes.skipFiles && modes.apply ? chalk.green('▶') : ' '
    } 👀 Watches for changes with --apply --skip-files to directly apply changes to local database

  ${chalk.cyan('yarn db:build:migrations:apply')}
    ${
      modes.apply ? chalk.green('▶') : ' '
    } 🚀 Build & Apply - Generates migrations and (directly) applies them to local DB

    ${chalk.bold('Flags:')}
    --filter=pattern ${
      modes.filter ? chalk.green('✓') : '🎯'
    } Only process templates matching the pattern
    --apply          ${
      modes.apply ? chalk.green('✓') : '📥'
    } Directly apply migrations to local database
    --skip-files     ${modes.skipFiles ? chalk.green('✓') : '🏃'} Skip migration file generation
    --force          ${modes.force ? chalk.green('✓') : '💪'} Force regeneration of all templates
    --register=file  ${
      modes.register ? chalk.green('✓') : '📝'
    } Register template as already applied
  `);
}

export function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export async function registerTemplate(templatePath: string, dirname: string) {
  const content = await readFile(templatePath, 'utf-8');
  const currentHash = await calculateMD5(content);
  const relativeTemplatePath = path.relative(dirname, templatePath);

  // Update both build logs
  const buildLog = await loadBuildLog(dirname);
  const localBuildLog = await loadLocalBuildLog(dirname);

  // Register in build log
  buildLog.templates[relativeTemplatePath] = {
    lastHash: currentHash,
    lastBuilt: new Date().toISOString(),
    lastMigration: `registered_${path.basename(templatePath)}`, // Virtual migration name
  };

  // Register in local build log
  localBuildLog.templates[relativeTemplatePath] = {
    lastApplied: currentHash,
  };

  await saveBuildLog(dirname, buildLog);
  await saveLocalBuildLog(dirname, localBuildLog);

  return { buildLog, localBuildLog };
}
