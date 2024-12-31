import EventEmitter from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import type { BuildLog, ProcessedTemplateResult, TemplateStatus } from '../types.js';
import { applyMigration } from '../utils/applyMigration.js';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { getConfig } from '../utils/config.js';
import { testConnection } from '../utils/databaseConnection.js';
import { getNextTimestamp } from '../utils/getNextTimestamp.js';
import { isWipTemplate } from '../utils/isWipTemplate.js';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { type LogLevel, logger } from '../utils/logger.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';

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
  private silent: boolean;

  // Constructor:
  private constructor(
    baseDir: string,
    buildLog: BuildLog,
    localBuildLog: BuildLog,
    config: Awaited<ReturnType<typeof getConfig>>,
    options: { silent?: boolean } = {}
  ) {
    super();
    this.silent = options.silent ?? false;
    this.baseDir = baseDir;
    this.buildLog = buildLog;
    this.localBuildLog = localBuildLog;
    this.config = config;
  }

  static async create(baseDir: string, options: { silent?: boolean } = {}) {
    const config = await getConfig(baseDir);
    const buildLog = await loadBuildLog(baseDir, 'common');
    const localBuildLog = await loadBuildLog(baseDir, 'local');
    return new TemplateManager(baseDir, buildLog, localBuildLog, config, options);
  }

  private isCacheValid(cache: TemplateCache): boolean {
    return Date.now() - cache.lastChecked < this.cacheTimeout;
  }

  private invalidateCache(templatePath: string) {
    this.templateCache.delete(templatePath);
  }

  async findTemplates(): Promise<string[]> {
    const templatePath = path.join(this.baseDir, this.config.templateDir, this.config.filter);
    const matches = await glob(templatePath);
    return matches;
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
      ignored: /(^|[\\])\../,
    });

    watcher.on('change', async (filepath: string) => {
      if (path.extname(filepath) === '.sql') {
        await this.handleTemplateChange(filepath);
      }
    });

    return watcher;
  }

  async applyTemplate(templatePath: string): Promise<ProcessedTemplateResult> {
    const template = await this.getTemplateStatus(templatePath);
    const content = await fs.readFile(templatePath, 'utf-8');
    const result = await applyMigration(content, template.name, this.silent);
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
      this.log(`Skipping WIP template: ${template.name}`, 'skip');
      return;
    }

    const content = await fs.readFile(templatePath, 'utf-8');
    const currentHash = await calculateMD5(content);

    if (!force && this.buildLog.templates[relPath]?.lastBuildHash === currentHash) {
      this.log(`Skipping unchanged template: ${template.name}`, 'skip');
      return;
    }

    const timestamp = await getNextTimestamp(this.buildLog);
    const prefix = this.config.migrationPrefix ? `${this.config.migrationPrefix}-` : '';
    const migrationName = `${timestamp}_${prefix}${template.name}.sql`;
    const migrationPath = path.join(this.config.migrationDir, migrationName);

    const header = `-- Generated with srtd from template: ${this.config.templateDir}/${template.name}.sql\n`;
    const banner = this.config.banner ? `-- ${this.config.banner}\n` : '\n';
    const lastBuildAt = this.buildLog.templates[relPath]?.lastMigrationFile;
    const footer = `${this.config.footer}\n-- Last built: ${lastBuildAt || 'Never'}\n-- Built with https://github.com/t1mmen/srtd\n`;

    const safeContent = this.config.wrapInTransaction ? `BEGIN;\n\n${content}\n\nCOMMIT;` : content;
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

  private log(msg: string, logLevel: LogLevel = 'info') {
    if (this.silent) return;
    logger[logLevel](msg);
  }
  async processTemplates(options: {
    apply?: boolean;
    generateFiles?: boolean;
    force?: boolean;
  }): Promise<ProcessedTemplateResult> {
    const templates = await this.findTemplates();
    const result: ProcessedTemplateResult = { errors: [], applied: [] };

    this.log('\n');

    if (options.apply) {
      const isConnected = await testConnection();

      if (isConnected) {
        this.log('Connected to database', 'success');
      } else {
        this.log('Failed to connect to database, cannot proceed. Is Supabase running?', 'error');
        return result;
      }

      const action = options.force ? 'Force applying' : 'Applying';
      this.log(`${action} changed templates to local database...`, 'success');
      let hasChanges = false;

      for (const templatePath of templates) {
        const template = await this.getTemplateStatus(templatePath);
        const needsApply =
          !template.buildState.lastAppliedHash ||
          template.buildState.lastAppliedHash !== template.currentHash;

        if (needsApply) {
          hasChanges = true;
          const applyResult = await this.applyTemplate(templatePath);
          result.errors.push(...applyResult.errors);
          result.applied.push(...applyResult.applied);
        }
      }

      if (!hasChanges) {
        this.log('No changes to apply', 'skip');
      } else if (result.errors.length > 0) {
        this.log(`${result.errors.length} template(s) failed to apply`, 'error');
        for (const err of result.errors) {
          this.log(`${err.file}: ${err.error}`, 'error');
        }
      } else {
        this.log(`Applied ${result.applied.length} template(s)`, 'success');
      }
    }

    if (options.generateFiles) {
      let built = 0;
      let skipped = 0;

      this.log('Building migration files from templates...', 'success');

      for (const templatePath of templates) {
        const isWip = await isWipTemplate(templatePath);
        if (!isWip) {
          const template = await this.getTemplateStatus(templatePath);
          if (options.force || template.currentHash !== template.buildState.lastBuildHash) {
            await this.buildTemplate(templatePath, options.force);
            built++;
          } else {
            skipped++;
          }
        }
      }

      if (built > 0) {
        this.log(`Generated ${built} migration file(s)`, 'success');
      } else if (skipped > 0) {
        this.log('No new changes to build', 'skip');
      }
    }

    return result;
  }
}
