import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { loadBuildLog } from './loadBuildLog.js';
import { saveBuildLog } from './saveBuildLog.js';
import { calculateMD5 } from './calculateMD5.js';
import { getConfig } from './config.js';
import { fileExists } from './fileExists.js';

export async function registerTemplate(templatePath: string, baseDir: string): Promise<void> {
  const config = await getConfig(baseDir);

  // Try multiple path resolutions
  const pathsToTry = [
    templatePath, // As provided
    path.join(baseDir, config.templateDir, templatePath), // In templates dir
  ];

  let resolvedPath: string | null = null;
  for (const p of pathsToTry) {
    if (await fileExists(p)) {
      resolvedPath = p;
      break;
    }
  }

  if (!resolvedPath) {
    console.log(chalk.red('Error:'), `Template file not found. Tried:`);
    for (const p of pathsToTry) {
      console.log(chalk.dim(`  - ${p}`));
    }
    throw new Error(`Template ${templatePath} not found`);
  }

  const content = await fs.readFile(resolvedPath, 'utf-8');
  const hash = await calculateMD5(content);
  const relativePath = path.relative(baseDir, resolvedPath);
  const now = new Date().toISOString();

  // Update build log
  const buildLog = await loadBuildLog(baseDir, 'common');
  buildLog.templates[relativePath] = {
    lastBuildHash: hash,
    lastBuildDate: now,
    lastMigrationFile: ``, // Unknown, may want to allow entering this?
  };

  await saveBuildLog(baseDir, buildLog, 'common');
  console.log(chalk.green(`✓ Registered template:`), relativePath);
}
