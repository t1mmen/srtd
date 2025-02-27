import EventEmitter from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FSWatcher } from 'chokidar';
import { glob } from 'glob';
import type { BuildLog, ProcessedTemplateResult, TemplateStatus } from '../types.js';
import { applyMigration } from '../utils/applyMigration.js';
import { calculateMD5 } from '../utils/calculateMD5.js';
import { getConfig } from '../utils/config.js';
import { getNextTimestamp } from '../utils/getNextTimestamp.js';
import { isWipTemplate } from '../utils/isWipTemplate.js';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { type LogLevel, logger } from '../utils/logger.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';

interface TemplateCache {
  status: TemplateStatus;
  lastChecked: number;
}
// Track watchers globally
declare global {
  var __srtd_watchers: FSWatcher[];
}

if (!global.__srtd_watchers) {
  global.__srtd_watchers = [];
}

export class TemplateManager extends EventEmitter implements Disposable {
  private watcher: FSWatcher | null = null;
  private baseDir: string;
  private buildLog: BuildLog;
  private localBuildLog: BuildLog;
  private config: Awaited<ReturnType<typeof getConfig>>;
  private templateCache: Map<string, TemplateCache> = new Map();
  private cacheTimeout = 1000;
  private silent: boolean;
  private processQueue: Set<string> = new Set();
  private processingTemplate: string | null = null;
  private processing = false;

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

  [Symbol.dispose](): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
    this.removeAllListeners();
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

    try {
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
        wip: await isWipTemplate(templatePath),
      };

      this.templateCache.set(templatePath, {
        status,
        lastChecked: Date.now(),
      });

      return status;
    } catch (error) {
      // Handle file not found errors gracefully
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // For file not found errors, log and return a placeholder status
        this.log(`Template file not found: ${templatePath}`, 'warn');

        // Return a placeholder status without caching
        return {
          name: path.basename(templatePath, '.sql'),
          path: templatePath,
          currentHash: '',
          migrationHash: null,
          buildState: {},
          wip: false,
        };
      }

      // Re-throw other errors
      throw error;
    }
  }

  private async saveBuildLogs(): Promise<void> {
    try {
      await Promise.all([
        saveBuildLog(this.baseDir, this.buildLog, 'common'),
        saveBuildLog(this.baseDir, this.localBuildLog, 'local'),
      ]);
    } catch (error) {
      throw new Error(`Failed to save build logs: ${error}`);
    }
  }

  private async handleTemplateChange(templatePath: string): Promise<void> {
    // Add to queue if not already there
    if (!this.processQueue.has(templatePath) && this.processingTemplate !== templatePath) {
      this.processQueue.add(templatePath);
    }

    if (!this.processing) {
      this.processing = true;
      await this.processNextTemplate();
    }
  }

  private async processTemplate(
    templatePath: string,
    force = false
  ): Promise<ProcessedTemplateResult> {
    try {
      this.invalidateCache(templatePath);

      // Check if file exists first
      const exists = await fs
        .stat(templatePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        const templateName = path.basename(templatePath, '.sql');
        this.log(`Template file not found: ${templatePath}`, 'warn');
        return {
          errors: [],
          applied: [],
          skipped: [templateName],
          built: [],
        };
      }

      const template = await this.getTemplateStatus(templatePath);
      const relPath = path.relative(this.baseDir, templatePath);

      const needsProcessing =
        force ||
        !this.localBuildLog.templates[relPath]?.lastAppliedHash ||
        this.localBuildLog.templates[relPath]?.lastAppliedHash !== template.currentHash;

      if (needsProcessing) {
        this.emit('templateChanged', template);
        const result = await this.applyTemplate(templatePath);

        if (result.errors.length) {
          const error = result.errors[0];
          const formattedError = typeof error === 'string' ? error : error?.error;

          this.emit('templateError', { template, error: formattedError });
        } else {
          const updatedTemplate = await this.getTemplateStatus(templatePath);
          this.emit('templateApplied', updatedTemplate);
        }
        return result;
      }

      return { errors: [], applied: [], skipped: [template.name], built: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Error processing template ${templatePath}: ${errorMessage}`, 'error');

      // Create a safe template object for the error event
      const templateName = path.basename(templatePath, '.sql');
      const safeTemplate = {
        name: templateName,
        path: templatePath,
        currentHash: '',
        migrationHash: null,
        buildState: {},
        wip: false,
      };

      this.emit('templateError', {
        template: safeTemplate,
        error: errorMessage,
      });

      return {
        errors: [
          {
            file: templatePath,
            error: errorMessage,
            templateName,
          },
        ],
        applied: [],
        skipped: [],
        built: [],
      };
    }
  }

  private async processNextTemplate(): Promise<void> {
    if (this.processQueue.size === 0) {
      this.processing = false;
      return;
    }

    const templatePath = this.processQueue.values().next().value;
    if (!templatePath) {
      this.processing = false;
      return;
    }

    this.processQueue.delete(templatePath);
    this.processingTemplate = templatePath;

    try {
      await this.processTemplate(templatePath);
    } finally {
      this.processingTemplate = null;
      await this.processNextTemplate();
    }
  }

  async watch(): Promise<{ close: () => Promise<void> }> {
    const chokidar = await import('chokidar');
    const templatePath = path.join(this.baseDir, this.config.templateDir);

    // Use more appropriate values for stabilityThreshold and pollInterval
    // This prevents excessive file events and improves reliability
    const watcher = chokidar.watch(templatePath, {
      ignoreInitial: false,
      ignored: ['**/!(*.sql)'],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 200, // Increased from 50ms to 200ms
        pollInterval: 100, // Increased from 50ms to 100ms
      },
    });

    // Track watcher globally
    global.__srtd_watchers.push(watcher);

    // Do initial scan once, but don't wait for each file to be processed
    // This prevents blocking and makes tests more reliable
    const existingFiles = await glob(path.join(templatePath, this.config.filter));
    for (const file of existingFiles) {
      // Don't await here - queue the files and let the queue process them
      void this.handleTemplateChange(file);
    }

    // Use debouncing for file change events
    // This prevents multiple rapid events for the same file
    const debouncedHandlers = new Map<string, NodeJS.Timeout>();

    const debouncedHandleEvent = (filepath: string) => {
      if (path.extname(filepath) !== '.sql') return;

      // Clear any existing debounce timer for this file
      const existingTimer = debouncedHandlers.get(filepath);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set a new debounce timer
      const timer = setTimeout(() => {
        void this.handleTemplateChange(filepath);
        debouncedHandlers.delete(filepath);
      }, 100); // 100ms debounce delay

      debouncedHandlers.set(filepath, timer);
    };

    watcher
      .on('add', debouncedHandleEvent)
      .on('change', debouncedHandleEvent)
      .on('error', error => {
        this.log(`Watcher error: ${error}`, 'error');
      });

    // Update cleanup
    this.watcher = watcher;
    return {
      close: async () => {
        // Clear any pending debounced handlers
        for (const timer of debouncedHandlers.values()) {
          clearTimeout(timer);
        }
        debouncedHandlers.clear();

        await watcher.close();
        const idx = global.__srtd_watchers.indexOf(watcher);
        if (idx > -1) global.__srtd_watchers.splice(idx, 1);
      },
    };
  }

  async applyTemplate(templatePath: string): Promise<ProcessedTemplateResult> {
    const template = await this.getTemplateStatus(templatePath);
    const content = await fs.readFile(templatePath, 'utf-8');
    const relPath = path.relative(this.baseDir, templatePath);

    try {
      const result = await applyMigration(content, template.name, this.silent);

      if (result === true) {
        // Always calculate fresh hash after successful apply
        const currentHash = await calculateMD5(content);

        if (!this.localBuildLog.templates[relPath]) {
          this.localBuildLog.templates[relPath] = {};
        }

        this.localBuildLog.templates[relPath] = {
          ...this.localBuildLog.templates[relPath],
          lastAppliedHash: currentHash,
          lastAppliedDate: new Date().toISOString(),
          lastAppliedError: undefined,
        };

        await this.saveBuildLogs();
        this.invalidateCache(templatePath);
        return { errors: [], applied: [template.name], skipped: [], built: [] };
      }

      // On error, don't update hash but track the error
      this.localBuildLog.templates[relPath] = {
        ...this.localBuildLog.templates[relPath],
        lastAppliedError: result.error,
      };

      await this.saveBuildLogs();
      return { errors: [result], applied: [], skipped: [], built: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!this.localBuildLog.templates) {
        this.localBuildLog = { templates: {}, version: '1.0', lastTimestamp: '' };
      }
      await this.saveBuildLogs();
      throw new Error(errorMessage);
    }
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

    try {
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
    } catch (error) {
      this.buildLog.templates[relPath] = {
        ...this.buildLog.templates[relPath],
        lastBuildError: error instanceof Error ? error.message : String(error),
      };

      await this.saveBuildLogs();
      this.emit('templateError', { template, error });
    }
  }

  private log(msg: string, logLevel: LogLevel = 'info') {
    if (this.silent) return;
    logger[logLevel](msg);
  }

  async processTemplates(options: {
    apply?: boolean;
    generateFiles?: boolean;
    force?: boolean;
    bundle?: boolean;
  }): Promise<ProcessedTemplateResult> {
    const templates = await this.findTemplates();
    const result: ProcessedTemplateResult = { errors: [], applied: [], built: [], skipped: [] };

    this.log('\n');

    if (options.apply) {
      const action = options.force ? 'Force applying' : 'Applying';
      this.log(`${action} changed templates to local database...`, 'success');

      // Process all templates
      for (const templatePath of templates) {
        try {
          const processResult = await this.processTemplate(templatePath, options.force);
          if (processResult) {
            result.errors.push(...(processResult.errors || []));
            result.applied.push(...(processResult.applied || []));
            result.skipped.push(...(processResult.skipped || []));
          } else {
            throw new Error('No result from processing template');
          }
        } catch (error) {
          result.errors.push({
            file: templatePath,
            templateName: templatePath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (result.applied.length === 0 && result.errors.length === 0) {
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
      if (options.bundle) {
        const timestamp = await getNextTimestamp(this.buildLog);
        const prefix = this.config.migrationPrefix ? `${this.config.migrationPrefix}-` : '';
        const migrationName = `${timestamp}_${prefix}bundle.sql`;
        const migrationPath = path.join(this.config.migrationDir, migrationName);

        let migrationContent = '';
        for (const templatePath of templates) {
          const template = await this.getTemplateStatus(templatePath);
          const isWip = await isWipTemplate(templatePath);
          const relPath = path.relative(this.baseDir, templatePath);

          if (isWip) {
            this.log(`Skipping WIP template: ${template.name}`, 'skip');
            result.skipped.push(template.name);
            continue;
          }

          const content = await fs.readFile(templatePath, 'utf-8');
          const currentHash = await calculateMD5(content);

          if (!force && this.buildLog.templates[relPath]?.lastBuildHash === currentHash) {
            this.log(`Skipping unchanged template: ${template.name}`, 'skip');
            result.skipped.push(template.name);
            continue;
          }

          const header = `-- Template: ${this.config.templateDir}/${template.name}.sql\n`;
          const banner = this.config.banner ? `-- ${this.config.banner}\n` : '\n';
          const lastBuildAt = this.buildLog.templates[relPath]?.lastMigrationFile;
          const footer = `${this.config.footer}\n-- Last built: ${lastBuildAt || 'Never'}\n-- Built with https://github.com/t1mmen/srtd\n`;

          const safeContent = this.config.wrapInTransaction ? `BEGIN;\n\n${content}\n\nCOMMIT;` : content;
          migrationContent += `${header}${banner}\n${safeContent}\n${footer}\n\n`;

          this.buildLog.templates[relPath] = {
            ...this.buildLog.templates[relPath],
            lastBuildHash: currentHash,
            lastBuildDate: new Date().toISOString(),
            lastMigrationFile: migrationName,
            lastBuildError: undefined,
          };

          this.invalidateCache(templatePath);
          result.built.push(template.name);
        }

        try {
          await fs.writeFile(path.resolve(this.baseDir, migrationPath), migrationContent);
          await this.saveBuildLogs();
          this.log(`Generated bundled migration file: ${migrationName}`, 'success');
        } catch (error) {
          this.log(`Failed to write bundled migration file: ${error}`, 'error');
          result.errors.push({
            file: migrationName,
            templateName: 'bundle',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        let built = 0;
        let skipped = 0;

        this.log('Building migration files from templates...', 'success');

        for (const templatePath of templates) {
          const isWip = await isWipTemplate(templatePath);
          if (!isWip) {
            const template = await this.getTemplateStatus(templatePath);
            if (options.force || template.currentHash !== template.buildState.lastBuildHash) {
              await this.buildTemplate(templatePath, options.force);
              result.built.push(template.name);
              built++;
            } else {
              result.skipped.push(template.name);
              skipped++;
            }
          } else {
            result.skipped.push(path.basename(templatePath, '.sql'));
            skipped++;
          }
        }

        if (built > 0) {
          this.log(`Generated ${built} migration file(s)`, 'success');
        } else if (skipped > 0) {
          this.log('No new changes to build', 'skip');
        }
      }
    }

    return result;
  }
}
