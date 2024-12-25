/**
 * See docs at https://docs.integrations.timelyapp.com/dev-env/database-templates
 */

import glob from 'glob';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { loadLocalBuildLog } from './loadLocalBuildLog';
import { loadBuildLog } from './loadBuildLog';
import { isWipTemplate } from './isWipTemplate';
import { saveBuildLog } from './saveBuildLog';
import { saveLocalBuildLog } from './saveLocalBuildLog';
import { getNextTimestamp } from './getNextTimestamp';
import { RTSQLArgs, RTSQLResult, MigrationError } from '../types';
import { applyMigration } from './applyMigration';
import { calculateMD5 } from './calculateMD5';
import { registerTemplate } from './registerTemplate';
import { displayErrorSummary } from './displayErrorSummary';
import { loadConfig } from './config';

export async function buildTemplates(args: RTSQLArgs = {}): Promise<RTSQLResult> {
  const config = await loadConfig();
  const baseDir = args.baseDir || process.cwd(); // path.dirname(fileURLToPath(import.meta.url));
  const filter = args.filter || '**/*.sql';
  const errors: MigrationError[] = [];
  const applied: string[] = [];

  const modes: RTSQLArgs = {
    force: args.force || false,
    apply: args.apply || false,
    skipFiles: args.skipFiles || false,
    filter: args.filter,
    register: args.register,
    verbose: args.verbose ?? true,
  };

  // console.clear();
  // displayHelp(modes);

  // Handle registration if requested
  if (modes.register) {
    // Split register argument into array if it's a string, handling both comma and space separators
    const templatesForRegistration =
      typeof modes.register === 'string'
        ? modes.register.split(/[,\s]+/).filter(Boolean)
        : Array.isArray(modes.register)
          ? modes.register
          : [modes.register];

    for (const template of templatesForRegistration) {
      const templatePath = path.resolve(baseDir, config.templateDir, template);
      try {
        await registerTemplate(templatePath, baseDir);
        console.log(`\n  ✅ Successfully registered template: ${chalk.cyan(template)}`);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`\n  ❌ Failed to register template: ${error.message}\n`);
        } else {
          console.error(`\n  ❌ Failed to register template: Unknown error\n`);
        }
        process.exit(1);
      }
    }
    console.log(
      `\n     ${templatesForRegistration.length} template(s) will be treated as already applied until modified.\n`
    );
    return { errors, applied };
  }

  const buildLog = await loadBuildLog(baseDir);
  const localBuildLog = await loadLocalBuildLog(baseDir);

  const templates = await new Promise<string[]>((resolve, reject) => {
    glob(path.join(baseDir, config.templateDir, filter), (err, matches) => {
      if (err) reject(err);
      else resolve(matches);
    });
  });
  console.log(`  📁 Found ${chalk.cyan(templates.length)} template(s)\n`);

  for (const templatePath of templates) {
    const content = await readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);
    const templateName = path.basename(templatePath, '.sql');
    const relativeTemplatePath = path.relative(baseDir, templatePath);
    const logEntry = buildLog.templates[relativeTemplatePath];

    // Skip if unchanged and not forced (for both file generation and DB apply)
    if (!modes.force) {
      const localLogEntry = localBuildLog.templates[relativeTemplatePath];
      const hasGeneratedMigration = logEntry?.lastMigrationFile;
      const isUnchangedSinceGeneration = logEntry?.lastBuildHash === currentHash;
      const isUnchangedSinceLastApply = localLogEntry?.lastAppliedHash === currentHash;

      if (modes.apply) {
        // Skip if the template is unchanged since last apply
        if (isUnchangedSinceLastApply) {
          if (modes.verbose) {
            console.log(`  ⏭️ ${chalk.dim(`Already applied: ${templateName}`)}`);
          }
          continue;
        }

        // Skip if there's a migration file and template hasn't changed
        if (hasGeneratedMigration && isUnchangedSinceGeneration) {
          console.log(`  ⏭️  ${chalk.dim(`Unchanged since last build: ${templateName}`)}`);
          continue;
        }
      } else if (!isWipTemplate(templatePath) && isUnchangedSinceGeneration) {
        // For non-apply mode, skip if unchanged and not a WIP template
        console.log(`  ⏭️  ${chalk.dim(`Unchanged: ${templateName}`)}`);
        continue;
      }
    }

    console.log(
      `  🔨  ${chalk.bold('Processing')}: ${chalk.cyan(templateName)}${
        isWipTemplate(templatePath) ? chalk.yellow(' [WIP]') : ''
      }`
    );

    // Apply to database if requested
    if (modes.apply) {
      console.log(`  🚀 Applying to DB...`);
      try {
        const result = await applyMigration(content, templateName);

        if (result !== true) {
          errors.push(result);
          // Update error state
          if (!buildLog.templates[relativeTemplatePath]) {
            buildLog.templates[relativeTemplatePath] = {};
          }
          buildLog.templates[relativeTemplatePath].lastAppliedError = result.error;
          continue;
        }

        applied.push(templateName);

        // Update template state
        if (!localBuildLog.templates[relativeTemplatePath]) {
          localBuildLog.templates[relativeTemplatePath] = {};
        }

        localBuildLog.templates[relativeTemplatePath].lastAppliedHash = currentHash;
        localBuildLog.templates[relativeTemplatePath].lastAppliedDate = new Date().toISOString();
        localBuildLog.templates[relativeTemplatePath].lastAppliedError = undefined;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.log(`  ❌ ${chalk.red('Failed to apply:')} ${error.message}`);
        } else {
          console.log(`  ❌ ${chalk.red('Failed to apply: Unknown error')}`);
        }
      }
    }

    if (modes.skipFiles) {
      console.log(`  ℹ️  ${chalk.dim('File generation disabled (--skip-files)')}`);
      continue;
    }

    if (isWipTemplate(templatePath)) {
      console.log(`      ${chalk.yellow('Skipping migration file generation for WIP template')}`);
      continue;
    }

    // Generate migration file
    const timestamp = await getNextTimestamp(buildLog);
    const migrationName = `${timestamp}_tmpl-${templateName}.sql`;
    const migrationPath = path.join(config.migrationDir, migrationName);

    const header = `-- Generated from template: /supabase/migrations-templates/${templateName}.sql`;
    const disclaimer =
      `-- **ONLY** use the migration template + yarn db:migration:build to adjust ANY SQL in this file\n` +
      `-- **DO NOT** write any manual migrations to change any SQL from this file`;
    const footer = `-- Last built: ${logEntry?.lastBuildDate || 'Never'}`;
    const migrationContent = `${header}\n${disclaimer}\n\nBEGIN;\n\n${content}\n\nCOMMIT;\n\n${disclaimer}\n${footer}`;

    // Write migration file
    await writeFile(path.resolve(baseDir, migrationPath), migrationContent);

    // Update build log
    buildLog.templates[relativeTemplatePath] = {
      ...buildLog.templates[relativeTemplatePath],
      lastBuildHash: currentHash,
      lastBuildDate: new Date().toISOString(),
      lastMigrationFile: migrationName,
      lastBuildError: undefined,
    };

    console.log(`  ✅  Generated: ${chalk.green(migrationName)}`);
  }

  // Save build log
  await saveBuildLog(baseDir, buildLog);
  await saveLocalBuildLog(baseDir, localBuildLog);

  if (errors.length) {
    console.log(`\n  ❌ ${chalk.red('Errors:')} ${errors.length} migration(s) failed\n`);
  }

  if (applied.length) {
    console.log(`  📦 Applied ${chalk.cyan(applied.length)} migration(s) to local database\n`);
  } else if (modes.apply) {
    console.log(`  💤 No changes to apply\n`);
  }

  displayErrorSummary(errors);

  return { errors, applied };
}
