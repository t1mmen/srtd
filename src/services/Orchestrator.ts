/**
 * Orchestrator Service - Central coordinator for unidirectional data flow
 * Manages coordination between FileSystemService, StateService, DatabaseService, and MigrationBuilder
 * Implements the flow: FileSystem Event → Orchestrator → StateService (check) → Action → StateService (update)
 */

import EventEmitter from 'node:events';
import path from 'node:path';
import type { BuildLog, CLIConfig, ProcessedTemplateResult, TemplateStatus } from '../types.js';
import { applyMigration } from '../utils/applyMigration.js';
import { isWipTemplate } from '../utils/isWipTemplate.js';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';
import { DatabaseService } from './DatabaseService.js';
import { FileSystemService } from './FileSystemService.js';
import type { WatchEvent } from './FileSystemService.js';
import { MigrationBuilder } from './MigrationBuilder.js';
import type { TemplateMetadata } from './MigrationBuilder.js';
import { StateService } from './StateService.js';

// Event types for Orchestrator
export interface OrchestratorEvent {
  templateChanged: TemplateStatus;
  templateApplied: TemplateStatus;
  templateBuilt: TemplateStatus;
  templateError: { template: TemplateStatus; error: string };
  operationComplete: ProcessedTemplateResult;
}

// Command options for different operations
export interface ApplyOptions {
  force?: boolean;
  templatePaths?: string[];
  silent?: boolean;
}

export interface BuildOptions {
  force?: boolean;
  bundle?: boolean;
  templatePaths?: string[];
  silent?: boolean;
}

export interface WatchOptions {
  silent?: boolean;
  initialProcess?: boolean;
}

// Orchestrator configuration
export interface OrchestratorConfig {
  baseDir: string;
  cliConfig: CLIConfig;
  silent?: boolean;
}

export class Orchestrator extends EventEmitter implements Disposable {
  private fileSystemService!: FileSystemService;
  private stateService!: StateService;
  private databaseService!: DatabaseService;
  private migrationBuilder!: MigrationBuilder;

  private buildLog!: BuildLog;
  private localBuildLog!: BuildLog;
  private config: OrchestratorConfig;

  private processQueue: Set<string> = new Set();
  private processingTemplate: string | null = null;
  private processing = false;
  private watching = false;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize the orchestrator and all services
   */
  async initialize(): Promise<void> {
    // Load build logs
    this.buildLog = await loadBuildLog(this.config.baseDir, 'common');
    this.localBuildLog = await loadBuildLog(this.config.baseDir, 'local');

    // Initialize services
    await this.initializeServices();

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Initialize all coordinated services
   */
  private async initializeServices(): Promise<void> {
    // Initialize FileSystemService
    this.fileSystemService = new FileSystemService({
      baseDir: this.config.baseDir,
      templateDir: this.config.cliConfig.templateDir,
      filter: this.config.cliConfig.filter,
      migrationDir: this.config.cliConfig.migrationDir,
      watchOptions: {
        ignoreInitial: false,
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    // Initialize StateService
    this.stateService = new StateService({
      baseDir: this.config.baseDir,
      autoSave: true,
    });
    await this.stateService.initialize();

    // Initialize DatabaseService
    this.databaseService = new DatabaseService({
      connectionString: this.config.cliConfig.pgConnection,
      maxConnections: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    // Initialize MigrationBuilder
    this.migrationBuilder = MigrationBuilder.fromConfig(this.config.cliConfig, this.config.baseDir);
  }

  /**
   * Set up event listeners for service coordination
   */
  private setupEventListeners(): void {
    // FileSystemService events - Core unidirectional flow entry point
    this.fileSystemService.on('template:changed', (event: WatchEvent) => {
      void this.handleFileSystemEvent('changed', event.path);
    });

    this.fileSystemService.on('template:added', (event: WatchEvent) => {
      void this.handleFileSystemEvent('added', event.path);
    });

    this.fileSystemService.on('error', (error: Error) => {
      this.log(`File system error: ${error.message}`, 'error');
    });

    // StateService events - For monitoring state transitions
    this.stateService.on('state:transition', event => {
      this.log(
        `Template state transition: ${event.templatePath} ${event.fromState} -> ${event.toState}`,
        'info'
      );
    });

    this.stateService.on('error', (error: Error) => {
      this.log(`State service error: ${error.message}`, 'error');
    });

    // DatabaseService events - For monitoring database operations
    this.databaseService.on('connection:established', () => {
      this.log('Database connection established', 'info');
    });

    this.databaseService.on('connection:lost', error => {
      this.log(`Database connection lost: ${error.message}`, 'warn');
    });

    this.databaseService.on('error', (error: Error) => {
      this.log(`Database service error: ${error.message}`, 'error');
    });
  }

  /**
   * Handle FileSystem events - Entry point for unidirectional flow
   */
  private async handleFileSystemEvent(
    _eventType: 'changed' | 'added',
    templatePath: string
  ): Promise<void> {
    if (!this.watching) return;

    // Add to processing queue if not already there
    if (!this.processQueue.has(templatePath) && this.processingTemplate !== templatePath) {
      this.processQueue.add(templatePath);
    }

    // Start processing if not already processing
    if (!this.processing) {
      this.processing = true;
      await this.processNextTemplate();
    }
  }

  /**
   * Process the next template in the queue
   */
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
      // Unidirectional flow: Orchestrator → StateService (check) → Action → StateService (update)
      await this.processTemplate(templatePath, false);
    } finally {
      this.processingTemplate = null;
      await this.processNextTemplate();
    }
  }

  /**
   * Process a single template through the unidirectional flow
   */
  private async processTemplate(
    templatePath: string,
    force = false
  ): Promise<ProcessedTemplateResult> {
    try {
      // Step 1: Check if file exists
      const exists = await this.fileSystemService.fileExists(templatePath);
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

      // Step 2: Read template file
      const templateFile = await this.fileSystemService.readTemplate(templatePath);

      // Step 3: StateService (check) - Unidirectional flow checkpoint
      const stateInfo = this.stateService.getTemplateStatus(templatePath);
      const needsProcessing =
        force || this.stateService.hasTemplateChanged(templatePath, templateFile.hash);

      if (!needsProcessing) {
        return {
          errors: [],
          applied: [],
          skipped: [templateFile.name],
          built: [],
        };
      }

      // Step 4: Update StateService with change detection
      if (!stateInfo || this.stateService.hasTemplateChanged(templatePath, templateFile.hash)) {
        await this.stateService.markAsChanged(templatePath, templateFile.hash);
      }

      // Step 5: Get current template status for event emission
      const template = await this.getTemplateStatus(templatePath);
      this.emit('templateChanged', template);

      // Step 6: Action - Apply template to database
      const result = await this.executeApplyTemplate(templatePath);

      // Step 7: Handle result and emit events
      if (result.errors.length > 0) {
        const error = result.errors[0];
        const formattedError = typeof error === 'string' ? error : error?.error;
        this.emit('templateError', { template, error: formattedError });
      } else {
        const updatedTemplate = await this.getTemplateStatus(templatePath);
        this.emit('templateApplied', updatedTemplate);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Error processing template ${templatePath}: ${errorMessage}`, 'error');

      // Create safe template object for error event
      const templateName = path.basename(templatePath, '.sql');
      const safeTemplate: TemplateStatus = {
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

  /**
   * Get template status by coordinating between services
   */
  private async getTemplateStatus(templatePath: string): Promise<TemplateStatus> {
    const templateFile = await this.fileSystemService.readTemplate(templatePath);
    const relPath = templateFile.relativePath;

    // Get state from StateService
    const stateInfo = this.stateService.getTemplateStatus(templatePath);

    // Merge build logs (keeping backward compatibility)
    const buildState = {
      ...this.buildLog.templates[relPath],
      ...this.localBuildLog.templates[relPath],
    };

    return {
      name: templateFile.name,
      path: templatePath,
      currentHash: templateFile.hash,
      migrationHash: null,
      buildState,
      wip: await isWipTemplate(templatePath),
    };
  }

  /**
   * Execute apply operation for a template
   */
  private async executeApplyTemplate(templatePath: string): Promise<ProcessedTemplateResult> {
    const template = await this.getTemplateStatus(templatePath);
    const templateFile = await this.fileSystemService.readTemplate(templatePath);
    const content = templateFile.content;
    const relPath = templateFile.relativePath;

    try {
      const result = await applyMigration(content, template.name, this.config.silent);

      if (result === true) {
        // Step: StateService (update) - Mark as applied in unidirectional flow
        await this.stateService.markAsApplied(templatePath, templateFile.hash);

        // Keep backward compatibility with build logs
        if (!this.localBuildLog.templates[relPath]) {
          this.localBuildLog.templates[relPath] = {};
        }

        this.localBuildLog.templates[relPath] = {
          ...this.localBuildLog.templates[relPath],
          lastAppliedHash: templateFile.hash,
          lastAppliedDate: new Date().toISOString(),
          lastAppliedError: undefined,
        };

        await this.saveBuildLogs();
        return { errors: [], applied: [template.name], skipped: [], built: [] };
      }

      // On error, update StateService and build logs
      await this.stateService.markAsError(templatePath, result.error, 'apply');

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

  /**
   * Command handler: Apply templates to database
   */
  async apply(options: ApplyOptions = {}): Promise<ProcessedTemplateResult> {
    const templates = options.templatePaths || (await this.fileSystemService.findTemplates());
    const result: ProcessedTemplateResult = { errors: [], applied: [], built: [], skipped: [] };

    this.log('\\n');
    const action = options.force ? 'Force applying' : 'Applying';
    this.log(`${action} changed templates to local database...`, 'success');

    for (const templatePath of templates) {
      try {
        const processResult = await this.processTemplate(templatePath, options.force);
        result.errors.push(...(processResult.errors || []));
        result.applied.push(...(processResult.applied || []));
        result.skipped.push(...(processResult.skipped || []));
      } catch (error) {
        result.errors.push({
          file: templatePath,
          templateName: templatePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Emit operation complete event
    this.emit('operationComplete', result);

    // Log results
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

    return result;
  }

  /**
   * Command handler: Build migration files from templates
   */
  async build(options: BuildOptions = {}): Promise<ProcessedTemplateResult> {
    const templates = options.templatePaths || (await this.fileSystemService.findTemplates());

    this.log('\\n');

    if (options.bundle) {
      return await this.executeBundledBuild(templates, options);
    } else {
      return await this.executeIndividualBuilds(templates, options);
    }
  }

  /**
   * Execute bundled migration build
   */
  private async executeBundledBuild(
    templatePaths: string[],
    options: BuildOptions
  ): Promise<ProcessedTemplateResult> {
    const result: ProcessedTemplateResult = { errors: [], applied: [], built: [], skipped: [] };
    const templates: TemplateMetadata[] = [];

    // Collect templates for bundle
    for (const templatePath of templatePaths) {
      const isWip = await isWipTemplate(templatePath);
      if (isWip) {
        const template = await this.getTemplateStatus(templatePath);
        this.log(`Skipping WIP template: ${template.name}`, 'skip');
        result.skipped.push(template.name);
        continue;
      }

      const templateFile = await this.fileSystemService.readTemplate(templatePath);
      const stateInfo = this.stateService.getTemplateStatus(templatePath);

      if (!options.force && stateInfo?.lastBuiltHash === templateFile.hash) {
        const template = await this.getTemplateStatus(templatePath);
        this.log(`Skipping unchanged template: ${template.name}`, 'skip');
        result.skipped.push(template.name);
        continue;
      }

      templates.push({
        name: templateFile.name,
        templatePath: templateFile.path,
        relativePath: templateFile.relativePath,
        content: templateFile.content,
        hash: templateFile.hash,
        lastBuildAt: this.buildLog.templates[templateFile.relativePath]?.lastMigrationFile,
      });

      result.built.push(templateFile.name);
    }

    try {
      // Generate bundled migration using MigrationBuilder
      const { result: migrationResult } =
        await this.migrationBuilder.generateAndWriteBundledMigration(templates, this.buildLog, {
          wrapInTransaction: this.config.cliConfig.wrapInTransaction,
        });

      // Update state for all included templates
      for (const template of templates) {
        await this.stateService.markAsBuilt(
          template.templatePath,
          template.hash,
          migrationResult.fileName
        );

        // Update build log
        const relPath = template.relativePath;
        this.buildLog.templates[relPath] = {
          ...this.buildLog.templates[relPath],
          lastBuildHash: template.hash,
          lastBuildDate: new Date().toISOString(),
          lastMigrationFile: migrationResult.fileName,
          lastBuildError: undefined,
        };
      }

      await this.saveBuildLogs();
      this.log(`Generated bundled migration file: ${migrationResult.fileName}`, 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Failed to write bundled migration file: ${errorMessage}`, 'error');
      result.errors.push({
        file: 'bundle',
        templateName: 'bundle',
        error: errorMessage,
      });
    }

    this.emit('operationComplete', result);
    return result;
  }

  /**
   * Execute individual migration builds
   */
  private async executeIndividualBuilds(
    templatePaths: string[],
    options: BuildOptions
  ): Promise<ProcessedTemplateResult> {
    const result: ProcessedTemplateResult = { errors: [], applied: [], built: [], skipped: [] };

    this.log('Building migration files from templates...', 'success');

    for (const templatePath of templatePaths) {
      try {
        const isWip = await isWipTemplate(templatePath);
        if (isWip) {
          const template = await this.getTemplateStatus(templatePath);
          this.log(`Skipping WIP template: ${template.name}`, 'skip');
          result.skipped.push(template.name);
          continue;
        }

        const templateFile = await this.fileSystemService.readTemplate(templatePath);
        const template = await this.getTemplateStatus(templatePath);
        const stateInfo = this.stateService.getTemplateStatus(templatePath);

        if (options.force || stateInfo?.lastBuiltHash !== templateFile.hash) {
          await this.executeBuildTemplate(templatePath);
          result.built.push(template.name);
        } else {
          result.skipped.push(template.name);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const templateName = path.basename(templatePath, '.sql');
        result.errors.push({
          file: templatePath,
          templateName,
          error: errorMessage,
        });
      }
    }

    // Log results
    if (result.built.length > 0) {
      this.log(`Generated ${result.built.length} migration file(s)`, 'success');
    } else if (result.skipped.length > 0) {
      this.log('No new changes to build', 'skip');
    }

    this.emit('operationComplete', result);
    return result;
  }

  /**
   * Build a single template migration file
   */
  private async executeBuildTemplate(templatePath: string): Promise<void> {
    const template = await this.getTemplateStatus(templatePath);
    const templateFile = await this.fileSystemService.readTemplate(templatePath);

    const templateMetadata: TemplateMetadata = {
      name: templateFile.name,
      templatePath: templateFile.path,
      relativePath: templateFile.relativePath,
      content: templateFile.content,
      hash: templateFile.hash,
      lastBuildAt: this.buildLog.templates[templateFile.relativePath]?.lastMigrationFile,
    };

    try {
      // Generate migration using MigrationBuilder
      const { result: migrationResult } = await this.migrationBuilder.generateAndWriteMigration(
        templateMetadata,
        this.buildLog,
        {
          wrapInTransaction: this.config.cliConfig.wrapInTransaction,
        }
      );

      // Update StateService - unidirectional flow update
      await this.stateService.markAsBuilt(
        templatePath,
        templateFile.hash,
        migrationResult.fileName
      );

      // Keep backward compatibility with build logs
      const relPath = templateFile.relativePath;
      this.buildLog.templates[relPath] = {
        ...this.buildLog.templates[relPath],
        lastBuildHash: templateFile.hash,
        lastBuildDate: new Date().toISOString(),
        lastMigrationFile: migrationResult.fileName,
        lastBuildError: undefined,
      };

      await this.saveBuildLogs();
      this.emit('templateBuilt', template);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update StateService with error
      await this.stateService.markAsError(templatePath, errorMessage, 'build');

      // Keep backward compatibility
      const relPath = templateFile.relativePath;
      this.buildLog.templates[relPath] = {
        ...this.buildLog.templates[relPath],
        lastBuildError: errorMessage,
      };

      await this.saveBuildLogs();
      this.emit('templateError', { template, error: errorMessage });
      throw error;
    }
  }

  /**
   * Command handler: Start watching for template changes
   */
  async watch(options: WatchOptions = {}): Promise<{ close: () => Promise<void> }> {
    this.watching = true;

    if (!options.silent) {
      this.log('Starting template watching...', 'info');
    }

    // Start FileSystemService watching
    await this.fileSystemService.watchTemplates();

    // Process initial templates if requested
    if (options.initialProcess) {
      const templates = await this.fileSystemService.findTemplates();
      for (const templatePath of templates) {
        void this.handleFileSystemEvent('changed', templatePath);
      }
    }

    return {
      close: async () => {
        this.watching = false;
        await this.fileSystemService.stopWatching();

        if (!options.silent) {
          this.log('Stopped template watching', 'info');
        }
      },
    };
  }

  /**
   * Find all templates using FileSystemService
   */
  async findTemplates(): Promise<string[]> {
    return this.fileSystemService.findTemplates();
  }

  /**
   * Get template status for external consumers
   */
  async getTemplateStatusExternal(templatePath: string): Promise<TemplateStatus> {
    return this.getTemplateStatus(templatePath);
  }

  /**
   * Save build logs to disk
   */
  private async saveBuildLogs(): Promise<void> {
    try {
      await Promise.all([
        saveBuildLog(this.config.baseDir, this.buildLog, 'common'),
        saveBuildLog(this.config.baseDir, this.localBuildLog, 'local'),
      ]);
    } catch (error) {
      throw new Error(`Failed to save build logs: ${error}`);
    }
  }

  /**
   * Logging utility
   */
  private log(
    msg: string,
    logLevel: 'info' | 'warn' | 'error' | 'success' | 'skip' = 'info'
  ): void {
    if (this.config.silent) return;

    // Simple logging for now - can be enhanced with proper logger
    const prefix = {
      info: '[INFO]',
      warn: '[WARN]',
      error: '[ERROR]',
      success: '[SUCCESS]',
      skip: '[SKIP]',
    }[logLevel];

    console.log(`${prefix} ${msg}`);
  }

  /**
   * Dispose of all services and clean up
   */
  [Symbol.dispose](): void {
    this.watching = false;
    void this.fileSystemService?.dispose();
    void this.stateService?.dispose();
    void this.databaseService?.dispose();
    this.removeAllListeners();
  }

  /**
   * Create orchestrator from CLI configuration
   */
  static async create(
    baseDir: string,
    cliConfig: CLIConfig,
    options: { silent?: boolean } = {}
  ): Promise<Orchestrator> {
    const orchestrator = new Orchestrator({
      baseDir,
      cliConfig,
      silent: options.silent,
    });

    await orchestrator.initialize();
    return orchestrator;
  }
}
