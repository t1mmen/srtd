import fs from 'fs/promises';
import path from 'path';
import { loadBuildLog } from './loadBuildLog';
import { saveBuildLog } from './saveBuildLog';
import { calculateMD5 } from './calculateMD5';

export async function registerTemplate(templatePath: string, baseDir: string) {
  const content = await fs.readFile(templatePath, 'utf-8');
  const hash = await calculateMD5(content);
  const relativePath = path.relative(baseDir, templatePath);
  const now = new Date().toISOString();

  // Update build log
  const buildLog = await loadBuildLog(baseDir, 'common');
  buildLog.templates[relativePath] = {
    lastBuildHash: hash,
    lastBuildDate: now,
    lastMigrationFile: `registered_${path.basename(templatePath)}`,
  };
  await saveBuildLog(baseDir, buildLog, 'common');
}
