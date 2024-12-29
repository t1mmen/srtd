import glob from 'glob';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { isWipTemplate } from '../utils/isWipTemplate.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';
import { getNextTimestamp } from '../utils/getNextTimestamp.js';
import { BuildLog, CLIArgs, CLIResult, MigrationError } from '../types.js';
import { applyMigration } from '../utils/applyMigration.js';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { loadConfig } from '../utils/config.js';

async function findTemplates(baseDir: string, filter: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob(path.join(baseDir, filter), (err, matches) => {
      if (err) reject(err);
      else resolve(matches);
    });
  });
}

async function applyTemplate(
  templatePath: string,
  content: string,
  currentHash: string,
  baseDir: string,
  localBuildLog: BuildLog
): Promise<{ error?: MigrationError }> {
  const templateName = path.basename(templatePath, '.sql');
  const relativeTemplatePath = path.relative(baseDir, templatePath);

  const result = await applyMigration(content, templateName);
  if (result !== true) {
    if (!localBuildLog.templates[relativeTemplatePath]) {
      localBuildLog.templates[relativeTemplatePath] = {};
    }
    localBuildLog.templates[relativeTemplatePath].lastAppliedError = result.error;
    return { error: result };
  }

  if (!localBuildLog.templates[relativeTemplatePath]) {
    localBuildLog.templates[relativeTemplatePath] = {};
  }
  localBuildLog.templates[relativeTemplatePath].lastAppliedHash = currentHash;
  localBuildLog.templates[relativeTemplatePath].lastAppliedDate = new Date().toISOString();
  localBuildLog.templates[relativeTemplatePath].lastAppliedError = undefined;

  return {};
}

export async function buildTemplates(args: CLIArgs = {}): Promise<CLIResult> {
  const config = await loadConfig();
  const baseDir = args.baseDir || process.cwd();
  const filter = args.filter || '**/*.sql';
  const errors: MigrationError[] = [];
  const applied: string[] = [];
  const verbose = args.verbose || true;
  const apply = args.apply || false;

  const buildLog = await loadBuildLog(baseDir, 'common');
  const localBuildLog = await loadBuildLog(baseDir, 'local');

  const templatePaths = await findTemplates(path.join(baseDir, config.templateDir), filter);

  if (verbose) {
    console.log(`  📁 Found ${chalk.yellow(templatePaths.length)} template(s)`);
  }

  for (const templatePath of templatePaths) {
    const content = await fs.readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);
    const templateName = path.basename(templatePath, '.sql');
    const relativeTemplatePath = path.relative(baseDir, templatePath);
    const wipTemplate = await isWipTemplate(templatePath);

    if (verbose) {
      console.log(
        `  🔨 ${chalk.bold('Processing')}: ${chalk.cyan(templateName)}${
          wipTemplate ? chalk.yellow(' [WIP]') : ''
        }`
      );
    }

    // Apply to database if requested
    if (apply && !wipTemplate) {
      const result = await applyTemplate(
        templatePath,
        content,
        currentHash,
        baseDir,
        localBuildLog
      );
      if (result.error) {
        errors.push(result.error);
      } else {
        applied.push(templateName);
      }
      await saveBuildLog(baseDir, localBuildLog, 'local');
    }

    // Skip file generation if requested, WIP, or unchanged
    if (args.skipFiles || wipTemplate) {
      continue;
    }

    // Skip if unchanged since last build
    const loggedTemplate = buildLog.templates[relativeTemplatePath];
    if (!args.force && loggedTemplate?.lastBuildHash === currentHash) {
      if (verbose) {
        console.log(`  ⏭️  ${chalk.dim(`Unchanged since last build: ${templateName}`)}`);
      }
      continue;
    }

    // Generate migration file
    const timestamp = await getNextTimestamp(buildLog);
    const migrationName = `${timestamp}_tmpl-${templateName}.sql`;
    const migrationPath = path.join(config.migrationDir, migrationName);

    const header = `-- Generated from template: ${config.templateDir}/${templateName}.sql\n`;
    const banner = config.banner ? `-- ${config.banner}\n` : '\n';
    const footer = `${config.footer}\n-- Last built: ${buildLog.templates[relativeTemplatePath]?.lastBuildDate || 'Never'}`;
    const safeContent = config.wrapInTransaction ? `BEGIN;\n${content}\nCOMMIT;` : content;
    const migrationContent = `${header}${banner}\n${safeContent}\n${footer}`;

    await fs.writeFile(path.resolve(baseDir, migrationPath), migrationContent);

    // Update build log
    buildLog.templates[relativeTemplatePath] = {
      ...buildLog.templates[relativeTemplatePath],
      lastBuildHash: currentHash,
      lastBuildDate: new Date().toISOString(),
      lastMigrationFile: migrationName,
      lastBuildError: undefined,
    };

    if (verbose) {
      console.log(`  ✅  Generated: ${chalk.green(migrationName)}`);
    }
  }

  await saveBuildLog(baseDir, buildLog, 'common');
  await saveBuildLog(baseDir, localBuildLog, 'local');

  if (verbose) {
    if (applied.length) {
      console.log(`  📦 Applied ${chalk.cyan(applied.length)} migration(s)`);
    } else if (apply) {
      console.log(`  💤 No changes to apply`);
    }
    if (errors.length) {
      console.log(`\n  ❌ ${chalk.red('Errors:')} ${errors.length} migration(s) failed\n`);
    }
  }

  return { errors, applied };
}
