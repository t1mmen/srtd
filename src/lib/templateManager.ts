import fs from 'fs/promises';
import glob from 'glob';
import path from 'path';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';
import { getConfig } from '../utils/config.js';
import { isWipTemplate } from '../utils/isWipTemplate.js';
import { applyMigration } from '../utils/applyMigration.js';
import { getNextTimestamp } from '../utils/getNextTimestamp.js';
import { logger } from '../utils/logger.js';
import type { BuildLog, TemplateStatus, CLIResult } from '../types.js';

export class TemplateManager {
  private baseDir: string;
  private buildLog: BuildLog;
  private localBuildLog: BuildLog;
  private config: Awaited<ReturnType<typeof getConfig>>;

  private constructor(
    baseDir: string,
    buildLog: BuildLog,
    localBuildLog: BuildLog,
    config: Awaited<ReturnType<typeof getConfig>>
  ) {
    this.baseDir = baseDir;
    this.buildLog = buildLog;
    this.localBuildLog = localBuildLog;
    this.config = config;
  }

  static async create(baseDir: string) {
    const config = await getConfig(baseDir);
    const buildLog = await loadBuildLog(baseDir, 'common');
    const localBuildLog = await loadBuildLog(baseDir, 'local');
    return new TemplateManager(baseDir, buildLog, localBuildLog, config);
  }

  async findTemplates(filter?: string): Promise<string[]> {
    const templatePath = path.join(this.baseDir, this.config.templateDir, filter || '**/*.sql');
    logger.debug(`Looking for templates in: ${templatePath}`);

    return new Promise((resolve, reject) => {
      glob(templatePath, (err, matches) => {
        if (err) {
          logger.error(`Failed to find templates: ${err.message}`);
          reject(err);
        } else {
          logger.debug(`Found ${matches.length} template(s)`);
          resolve(matches);
        }
      });
    });
  }

  async getTemplateStatus(templatePath: string): Promise<TemplateStatus> {
    const content = await fs.readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);
    const relPath = path.relative(this.baseDir, templatePath);
    const buildState = this.localBuildLog.templates[relPath] || {};

    return {
      name: path.basename(templatePath, '.sql'),
      path: templatePath,
      currentHash,
      migrationHash: null,
      buildState,
    };
  }

  private async generateMigration(
    templatePath: string,
    content: string,
    currentHash: string
  ): Promise<void> {
    const templateName = path.basename(templatePath, '.sql');
    const timestamp = await getNextTimestamp(this.buildLog);
    const migrationName = `${timestamp}_tmpl-${templateName}.sql`;
    const migrationPath = path.join(this.config.migrationDir, migrationName);
    const relPath = path.relative(this.baseDir, templatePath);

    const header = `-- Generated from template: ${this.config.templateDir}/${templateName}.sql\n`;
    const banner = this.config.banner ? `-- ${this.config.banner}\n` : '\n';
    const footer = `${this.config.footer}\n-- Last built: ${
      this.buildLog.templates[relPath]?.lastBuildDate || 'Never'
    }`;

    const safeContent = this.config.wrapInTransaction ? `BEGIN;\n${content}\nCOMMIT;` : content;
    const migrationContent = `${header}${banner}\n${safeContent}\n${footer}`;

    await fs.writeFile(path.resolve(this.baseDir, migrationPath), migrationContent);

    this.buildLog.templates[relPath] = {
      ...this.buildLog.templates[relPath],
      lastBuildHash: currentHash,
      lastBuildDate: new Date().toISOString(),
      lastMigrationFile: migrationName,
      lastBuildError: undefined,
    };

    await this.saveBuildLogs();
    logger.success(`Generated: ${migrationName}`);
  }

  private async saveBuildLogs(): Promise<void> {
    await Promise.all([
      saveBuildLog(this.baseDir, this.buildLog, 'common'),
      saveBuildLog(this.baseDir, this.localBuildLog, 'local'),
    ]);
  }

  async applyTemplate(template: TemplateStatus): Promise<CLIResult> {
    const content = await fs.readFile(template.path, 'utf-8');
    const result = await applyMigration(content, template.name);
    const relPath = path.relative(this.baseDir, template.path);

    if (result === true) {
      this.localBuildLog.templates[relPath] = {
        ...this.localBuildLog.templates[relPath],
        lastAppliedHash: template.currentHash,
        lastAppliedDate: new Date().toISOString(),
        lastAppliedError: undefined,
      };
      await this.saveBuildLogs();
      return { errors: [], applied: [template.name] };
    }

    this.localBuildLog.templates[relPath] = {
      ...this.localBuildLog.templates[relPath],
      lastAppliedError: result.error,
    };
    await this.saveBuildLogs();
    return { errors: [result], applied: [] };
  }

  async processTemplates(options: {
    filter?: string;
    apply?: boolean;
    generateFiles?: boolean;
    force?: boolean;
  }): Promise<CLIResult> {
    const templates = await this.findTemplates(options.filter);
    const result: CLIResult = { errors: [], applied: [] };

    for (const templatePath of templates) {
      const template = await this.getTemplateStatus(templatePath);
      const isWip = await isWipTemplate(templatePath);
      const relPath = path.relative(this.baseDir, templatePath);
      const { currentHash, buildState } = template;

      if (options.apply) {
        const hasChanges = buildState.lastAppliedHash !== currentHash;
        if (hasChanges) {
          const applyResult = await this.applyTemplate(template);
          result.errors.push(...applyResult.errors);
          result.applied.push(...applyResult.applied);
        }
      }

      if (options.generateFiles && !isWip) {
        const loggedTemplate = this.buildLog.templates[relPath];
        if (options.force || loggedTemplate?.lastBuildHash !== currentHash) {
          const content = await fs.readFile(templatePath, 'utf-8');
          await this.generateMigration(templatePath, content, currentHash);
        }
      } else if (options.generateFiles) {
        logger.skip(`Skipping WIP template: ${template.name}`);
      }
    }

    return result;
  }
}
