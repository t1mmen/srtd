import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { calculateMD5 } from './calculateMD5.js';
import { fileExists } from './fileExists.js';
import { loadBuildLog } from './loadBuildLog.js';
import { saveBuildLog } from './saveBuildLog.js';

export async function registerTemplate(templatePath: string, baseDir: string): Promise<void> {
  const pathsToTry = [
    path.resolve(templatePath),
    path.resolve(baseDir, templatePath),
    path.join(baseDir, templatePath)
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
      console.log(chalk.dim(`  - ${path.relative(baseDir, p)}`));
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
