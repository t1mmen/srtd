import fs from 'fs/promises';
import glob from 'glob';
import path from 'path';
import EventEmitter from 'events';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';
import { getConfig } from '../utils/config.js';
import { isWipTemplate } from '../utils/isWipTemplate.js';
import { applyMigration } from '../utils/applyMigration.js';
import { getNextTimestamp } from '../utils/getNextTimestamp.js';
import { logger } from '../utils/logger.js';
import type { BuildLog, TemplateStatus, CLIResult } from '../types.js';

interface TemplateCache {
  status: TemplateStatus;
  lastChecked: number;
}

export class TemplateManager extends EventEmitter {
  private baseDir: string;
  private buildLog: BuildLog;
  private localBuildLog: BuildLog;
  private config: Awaited<ReturnType<typeof getConfig>>;
  private templateCache: Map<string, TemplateCache> = new Map();
  private cacheTimeout = 1000;

  private constructor(
    baseDir: string,
    buildLog: BuildLog,
    localBuildLog: BuildLog,
    config: Awaited<ReturnType<typeof getConfig>>
  ) {
    super();
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

  private isCacheValid(cache: TemplateCache): boolean {
    return Date.now() - cache.lastChecked < this.cacheTimeout;
  }

  private invalidateCache(templatePath: string) {
    this.templateCache.delete(templatePath);
  }

  async findTemplates(): Promise<string[]> {
    const templatePath = path.join(this.baseDir, this.config.templateDir, this.config.filter);
    return new Promise((resolve, reject) => {
      glob(templatePath, (err, matches) => {
        if (err) reject(err);
        else resolve(matches);
      });
    });
  }

  async getTemplateStatus(templatePath: string): Promise<TemplateStatus> {
    const cached = this.templateCache.get(templatePath);
    if (cached && this.isCacheValid(cached)) {
      return cached.status;
    }

    const content = await fs.readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);
    const relPath = path.relative(this.baseDir, templatePath);

    // Merge build and apply states
    const buildState = {
      ...this.buildLog.templates[relPath],
      ...this.localBuildLog.templates[relPath],
    };

    const status = {
      name: path.basename(templatePath, '.sql'),
      path: templatePath,
      currentHash,
      migrationHash: null,
      buildState,
    };

    this.templateCache.set(templatePath, {
      status,
      lastChecked: Date.now(),
    });

    return status;
  }

  private async saveBuildLogs(): Promise<void> {
    await Promise.all([
      saveBuildLog(this.baseDir, this.buildLog, 'common'),
      saveBuildLog(this.baseDir, this.localBuildLog, 'local'),
    ]);
  }

  private async handleTemplateChange(templatePath: string): Promise<void> {
    this.invalidateCache(templatePath);
    const template = await this.getTemplateStatus(templatePath);
    this.emit('templateChanged', template);

    const result = await this.applyTemplate(templatePath);
    if (result.errors.length) {
      this.emit('templateError', {
        template,
        error: result.errors[0],
      });
    } else {
      const updatedTemplate = await this.getTemplateStatus(templatePath);
      this.emit('templateApplied', updatedTemplate);
    }
  }

  async watch(): Promise<{ close: () => void }> {
    const chokidar = await import('chokidar');
    const templatePath = path.join(this.baseDir, this.config.templateDir);

    const watcher = chokidar.watch(templatePath, {
      ignoreInitial: true,
      depth: 0,
      ignored: /(^|[\/\\])\../,
    });

    watcher.on('change', async (filepath: string) => {
      if (path.extname(filepath) === '.sql') {
        await this.handleTemplateChange(filepath);
      }
    });

    return watcher;
  }

  async applyTemplate(templatePath: string): Promise<CLIResult> {
    const template = await this.getTemplateStatus(templatePath);
    const content = await fs.readFile(templatePath, 'utf-8');
    const result = await applyMigration(content, template.name);
    const relPath = path.relative(this.baseDir, templatePath);

    this.invalidateCache(templatePath);

    if (result === true) {
      this.localBuildLog.templates[relPath] = {
        ...this.localBuildLog.templates[relPath],
        lastAppliedHash: template.currentHash,
        lastAppliedDate: new Date().toISOString(),
        lastAppliedError: undefined,
      };
      await this.saveBuildLogs();
      this.emit('templateApplied', template);
      return { errors: [], applied: [template.name] };
    }

    this.localBuildLog.templates[relPath] = {
      ...this.localBuildLog.templates[relPath],
      lastAppliedError: result.error,
    };
    await this.saveBuildLogs();
    this.emit('templateError', { template, error: result });
    return { errors: [result], applied: [] };
  }

  async buildTemplate(templatePath: string, force = false): Promise<void> {
    const template = await this.getTemplateStatus(templatePath);
    const isWip = await isWipTemplate(templatePath);
    const relPath = path.relative(this.baseDir, templatePath);

    if (isWip) {
      logger.skip(`Skipping WIP template: ${template.name}`);
      return;
    }

    const content = await fs.readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);

    if (!force && this.buildLog.templates[relPath]?.lastBuildHash === currentHash) {
      logger.skip(`Skipping unchanged template: ${template.name}`);
      return;
    }

    const timestamp = await getNextTimestamp(this.buildLog);
    const migrationName = `${timestamp}_tmpl-${template.name}.sql`;
    const migrationPath = path.join(this.config.migrationDir, migrationName);

    const header = `-- Generated from template: ${this.config.templateDir}/${template.name}.sql\n`;
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

    this.invalidateCache(templatePath);
    await this.saveBuildLogs();
    this.emit('templateBuilt', template);
  }

  async processTemplates(options: {
    apply?: boolean;
    generateFiles?: boolean;
    force?: boolean;
  }): Promise<CLIResult> {
    const templates = await this.findTemplates();
    const result: CLIResult = { errors: [], applied: [] };

    for (const templatePath of templates) {
      const template = await this.getTemplateStatus(templatePath);

      if (options.apply) {
        const needsApply =
          !template.buildState.lastAppliedHash ||
          template.buildState.lastAppliedHash !== template.currentHash;

        if (needsApply) {
          const applyResult = await this.applyTemplate(templatePath);
          result.errors.push(...applyResult.errors);
          result.applied.push(...applyResult.applied);
        }
      }

      if (options.generateFiles) {
        await this.buildTemplate(templatePath, options.force);
      }
    }

    return result;
  }
}
