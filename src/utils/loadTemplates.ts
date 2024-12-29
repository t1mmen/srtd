import fs from 'fs/promises';
import glob from 'glob';
import path from 'path';
import { getConfig } from './config.js';
import { calculateMD5 } from './calculateMD5.js';
import { getMigrationFileHash } from './getMigrationFileHash.js';
import { TemplateStatus } from '../types.js';
import { loadBuildLog } from './loadBuildLog.js';

export async function loadTemplates(
  dirname: string,
  optionalFilter?: string
): Promise<TemplateStatus[]> {
  const config = await getConfig(dirname);
  const buildLog = await loadBuildLog(dirname, 'local');
  const filter = optionalFilter || config.filter;
  const templatePath = path.join(dirname, config.templateDir, filter);

  const templates = await new Promise<string[]>((resolve, reject) => {
    glob(templatePath, (err, matches) => {
      if (err) reject(err);
      else resolve(matches);
    });
  });

  const results: TemplateStatus[] = [];

  for (const templatePath of templates) {
    const content = await fs.readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);
    const relPath = path.join(config.templateDir, path.basename(templatePath));
    const buildState = buildLog.templates[relPath] || {};

    results.push({
      name: path.basename(templatePath, '.sql'),
      path: templatePath,
      currentHash,
      migrationHash: null,
      buildState,
    });
  }

  return results;
}
