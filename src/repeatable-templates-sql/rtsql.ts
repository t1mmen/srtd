/**
 * See docs at https://docs.integrations.timelyapp.com/dev-env/database-templates
 */

import glob from 'glob';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import chalk from 'chalk';
import {
  TEMPLATE_DIR,
  MIGRATION_DIR,
  calculateMD5,
  loadBuildLog,
  saveBuildLog,
  loadLocalBuildLog,
  saveLocalBuildLog,
  getNextTimestamp,
  applyMigration,
  displayHelp,
  isWipTemplate,
  registerTemplate,
  displayErrorSummary,
} from './rtsql.utils';
import { BuildModes, MigrationError } from './rtsql.types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildTemplates() {
  const argv = minimist(process.argv.slice(2));
  const filter = argv.filter || '**/*.sql';
  const errors: MigrationError[] = [];
  const applied: string[] = [];
  const modes: BuildModes = {
    force: argv.force || false,
    apply: argv.apply || false,
    skipFiles: argv['skip-files'] || false,
    filter: !!argv.filter,
    register: argv.register,
    verbose: argv.verbose || true,
  };

  // console.clear();
  displayHelp(modes);

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
      const templatePath = path.resolve(__dirname, TEMPLATE_DIR, template);
      try {
        await registerTemplate(templatePath, __dirname);
        console.log(`\n  ✅ Successfully registered template: ${chalk.cyan(template)}`);
      } catch (error: any) {
        console.error(`\n  ❌ Failed to register template: ${error.message}\n`);
        process.exit(1);
      }
    }
    console.log(
      `\n     ${templatesForRegistration.length} template(s) will be treated as already applied until modified.\n`
    );
    return;
  }

  const buildLog = await loadBuildLog(__dirname);
  const localBuildLog = await loadLocalBuildLog(__dirname);

  console.log('\n  🔍 Scanning templates...');
  const templates = await new Promise<string[]>((resolve, reject) => {
    glob(path.join(__dirname, TEMPLATE_DIR, filter), (err, matches) => {
      if (err) reject(err);
      else resolve(matches);
    });
  });
  console.log(`  📁 Found ${chalk.cyan(templates.length)} template(s)\n`);

  if (modes.skipFiles) {
    console.log(`  ℹ️  ${chalk.dim('File generation disabled (--skip-files)')}`);
  }

  for (const templatePath of templates) {
    const content = await readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);
    const templateName = path.basename(templatePath, '.sql');
    const relativeTemplatePath = path.relative(__dirname, templatePath);
    const logEntry = buildLog.templates[relativeTemplatePath];

    // Skip if unchanged and not forced (for both file generation and DB apply)
    if (!modes.force) {
      const localLogEntry = localBuildLog.templates[relativeTemplatePath];
      const hasGeneratedMigration = logEntry?.lastMigration;
      const isUnchangedSinceGeneration = logEntry?.lastHash === currentHash;
      const isUnchangedSinceLastApply = localLogEntry?.lastApplied === currentHash;

      if (modes.apply) {
        // Skip if the template is unchanged since last apply
        if (isUnchangedSinceLastApply) {
          if (modes.verbose) {
            console.log(`  ⏭️  ${chalk.dim(`Already applied: ${templateName}`)}`);
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
        const tempPath = path.resolve(__dirname, '../.temp-migration.sql');
        try {
          // Create a consistent hash for the lock key based on the template name
          const lockKey = Math.abs(Buffer.from(templateName).reduce((acc, byte) => acc + byte, 0));

          // Wrap the content in a transaction with advisory lock
          const wrappedContent =
            `BEGIN;\n\n` +
            `-- Acquire advisory lock for this template\n` +
            `SELECT pg_advisory_xact_lock(${lockKey}::bigint);\n\n` +
            `${content}\n\n` +
            `COMMIT;\n`;

          await writeFile(tempPath, wrappedContent);
          const result = await applyMigration(tempPath, templateName);
          if (result !== true) {
            errors.push(result);
            continue;
          }
          applied.push(templateName);
        } finally {
          await fs.unlink(tempPath).catch(() => {}); // Single cleanup point
        }

        // Update applied status in local build log
        if (!localBuildLog.templates[relativeTemplatePath]) {
          localBuildLog.templates[relativeTemplatePath] = {
            lastApplied: currentHash,
          };
        } else {
          localBuildLog.templates[relativeTemplatePath].lastApplied = currentHash;
        }
      } catch (error: any) {
        console.log(`  ❌ ${chalk.red('Failed to apply:')} ${error.message}`);
      }
    }

    if (modes.skipFiles) {
      continue;
    }

    if (isWipTemplate(templatePath)) {
      console.log(`      ${chalk.yellow('Skipping migration file generation for WIP template')}`);
      continue;
    }

    // Generate migration file
    const timestamp = await getNextTimestamp(buildLog);
    const migrationName = `${timestamp}_tmpl-${templateName}.sql`;
    const migrationPath = path.join(MIGRATION_DIR, migrationName);

    const header = `-- Generated from template: /supabase/migrations-templates/${templateName}.sql`;
    const disclaimer =
      `-- **ONLY** use the migration template + yarn db:migration:build to adjust ANY SQL in this file\n` +
      `-- **DO NOT** write any manual migrations to change any SQL from this file`;
    const footer = `-- Last built: ${logEntry?.lastBuilt || 'Never'}`;
    const migrationContent = `${header}\n${disclaimer}\n\nBEGIN;\n\n${content}\n\nCOMMIT;\n\n${disclaimer}\n${footer}`;

    // Write migration file
    await writeFile(path.resolve(__dirname, migrationPath), migrationContent);

    // Update build log
    buildLog.templates[relativeTemplatePath] = {
      lastHash: currentHash,
      lastBuilt: new Date().toISOString(),
      lastMigration: migrationName,
    };

    console.log(`  ✅  Generated: ${chalk.green(migrationName)}`);
  }

  // Save build log
  await saveBuildLog(__dirname, buildLog);
  await saveLocalBuildLog(__dirname, localBuildLog);

  if (errors.length) {
    console.log(`\n  ❌ ${chalk.red('Errors:')} ${errors.length} migration(s) failed\n`);
  } else {
    console.log('\n  ✅ No errors found!\n');
  }

  if (applied.length) {
    console.log(`  📦 Applied ${chalk.cyan(applied.length)} migration(s) to local database\n`);
  } else if (modes.apply) {
    console.log(`  ⏸️ No changes to apply\n`);
  }

  displayErrorSummary(errors);
}

buildTemplates().catch(error => {
  console.error(`\n  ❌ ${chalk.red('Error:')} ${error.message}\n`);
  process.exit(1);
});
