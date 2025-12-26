/**
 * Orchestrator Service - Central coordinator for unidirectional data flow
 * Manages coordination between FileSystemService, StateService, DatabaseService, and MigrationBuilder
 * Implements the flow: FileSystem Event → Orchestrator → StateService (check) → Action → StateService (update)
 */

import EventEmitter from 'node:events';
import path from 'node:path';
import type { CLIConfig, ProcessedTemplateResult, TemplateStatus } from '../types.js';
import { isWipTemplate } from '../utils/isWipTemplate.js';
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

  private config: OrchestratorConfig;

  private processQueue: Set<string> = new Set();
  private pendingRecheck: Set<string> = new Set(); // Templates that changed during processing
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
    // Initialize services (StateService loads and owns build logs)
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

    // Initialize StateService with build log paths from config
    this.stateService = new StateService({
      baseDir: this.config.baseDir,
      buildLogPath: path.join(this.config.baseDir, this.config.cliConfig.buildLog),
      localBuildLogPath: path.join(this.config.baseDir, this.config.cliConfig.localBuildLog),
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
   * Uses queue + pendingRecheck to prevent race conditions from rapid file changes
   */
  private async handleFileSystemEvent(
    _eventType: 'changed' | 'added',
    templatePath: string
  ): Promise<void> {
    if (!this.watching) return;

    if (this.processQueue.has(templatePath)) {
      // Already in queue, nothing to do
      return;
    }

    if (this.processingTemplate === templatePath) {
      // Template changed while being processed - mark for recheck
      this.pendingRecheck.add(templatePath);
    } else {
      // Add to processing queue
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
      // Check if template changed during processing - if so, requeue it
      if (this.pendingRecheck.has(templatePath)) {
        this.pendingRecheck.delete(templatePath);
        this.processQueue.add(templatePath);
      }
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

    // Get build state from StateService (single source of truth)
    const buildState = this.stateService.getTemplateBuildState(templatePath) || {};

    return {
      name: templateFile.name,
      path: templatePath,
      currentHash: templateFile.hash,
      migrationHash: null,
      buildState,
      wip: await isWipTemplate(templatePath, this.config.baseDir),
    };
  }

  /**
   * Execute apply operation for a template
   */
  private async executeApplyTemplate(templatePath: string): Promise<ProcessedTemplateResult> {
    const template = await this.getTemplateStatus(templatePath);
    const templateFile = await this.fileSystemService.readTemplate(templatePath);
    const content = templateFile.content;

    try {
      const result = await this.databaseService.executeMigration(
        content,
        template.name,
        this.config.silent
      );

      if (result === true) {
        // StateService (update) - Single source of truth for build logs
        await this.stateService.markAsApplied(templatePath, templateFile.hash);
        return { errors: [], applied: [template.name], skipped: [], built: [] };
      }

      // On error, update StateService (single source of truth)
      await this.stateService.markAsError(templatePath, result.error, 'apply');
      return { errors: [result], applied: [], skipped: [], built: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
    }
    return await this.executeIndividualBuilds(templates, options);
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
      const isWip = await isWipTemplate(templatePath, this.config.baseDir);
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

      // Get lastMigrationFile from StateService (single source of truth)
      const buildState = this.stateService.getTemplateBuildState(templatePath);
      templates.push({
        name: templateFile.name,
        templatePath: templateFile.path,
        relativePath: templateFile.relativePath,
        content: templateFile.content,
        hash: templateFile.hash,
        lastBuildAt: buildState?.lastMigrationFile,
      });

      result.built.push(templateFile.name);
    }

    try {
      // Generate bundled migration using MigrationBuilder
      // Use StateService's build log reference (read-only)
      const buildLog = this.stateService.getBuildLogForMigration();
      const { result: migrationResult } =
        await this.migrationBuilder.generateAndWriteBundledMigration(templates, buildLog, {
          wrapInTransaction: this.config.cliConfig.wrapInTransaction,
        });

      // Update state for all included templates (StateService handles build log updates)
      for (const template of templates) {
        await this.stateService.markAsBuilt(
          template.templatePath,
          template.hash,
          migrationResult.fileName
        );
      }

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
        const isWip = await isWipTemplate(templatePath, this.config.baseDir);
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

    // Get lastMigrationFile from StateService (single source of truth)
    const buildState = this.stateService.getTemplateBuildState(templatePath);
    const templateMetadata: TemplateMetadata = {
      name: templateFile.name,
      templatePath: templateFile.path,
      relativePath: templateFile.relativePath,
      content: templateFile.content,
      hash: templateFile.hash,
      lastBuildAt: buildState?.lastMigrationFile,
    };

    try {
      // Generate migration using MigrationBuilder
      // Use StateService's build log reference (read-only)
      const buildLog = this.stateService.getBuildLogForMigration();
      const { result: migrationResult } = await this.migrationBuilder.generateAndWriteMigration(
        templateMetadata,
        buildLog,
        {
          wrapInTransaction: this.config.cliConfig.wrapInTransaction,
        }
      );

      // Update StateService (single source of truth - handles build log updates)
      await this.stateService.markAsBuilt(
        templatePath,
        templateFile.hash,
        migrationResult.fileName
      );

      this.emit('templateBuilt', template);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update StateService with error (single source of truth)
      await this.stateService.markAsError(templatePath, errorMessage, 'build');

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
   * Register a template in the build log without building it
   * Used when importing existing migrations that should be tracked
   */
  async registerTemplate(templatePath: string): Promise<void> {
    // Validate template exists
    const exists = await this.fileSystemService.fileExists(templatePath);
    if (!exists) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    // Validate template is in the correct directory
    const templateDir = path.resolve(this.config.baseDir, this.config.cliConfig.templateDir);
    const resolvedPath = path.resolve(templatePath);
    if (!resolvedPath.startsWith(templateDir)) {
      throw new Error(
        `Template must be in configured templateDir: ${this.config.cliConfig.templateDir}/*`
      );
    }

    // Read template and compute hash
    const templateFile = await this.fileSystemService.readTemplate(templatePath);

    // Register via StateService (single source of truth)
    // Using markAsBuilt with undefined migration file to indicate registration without build
    await this.stateService.markAsBuilt(templatePath, templateFile.hash, undefined);
  }

  /**
   * Promote a WIP template by renaming it and updating build logs
   * @returns The new path after promotion
   */
  async promoteTemplate(templatePath: string): Promise<string> {
    // Validate template exists
    const exists = await this.fileSystemService.fileExists(templatePath);
    if (!exists) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    // Check if it's a WIP template
    const isWip = await isWipTemplate(templatePath, this.config.baseDir);
    if (!isWip) {
      throw new Error(`Template is not a WIP template: ${path.basename(templatePath)}`);
    }

    // Calculate new path (remove WIP indicator)
    const newPath = templatePath.replace(this.config.cliConfig.wipIndicator, '');

    // Rename file via FileSystemService
    await this.fileSystemService.renameFile(templatePath, newPath);

    // Update build logs via StateService (single source of truth)
    await this.stateService.renameTemplate(templatePath, newPath);

    return newPath;
  }

  /**
   * Clear build logs via StateService (single source of truth)
   * @param type - 'local' clears local only, 'shared' clears shared only, 'both' clears all
   */
  async clearBuildLogs(type: 'local' | 'shared' | 'both'): Promise<void> {
    await this.stateService.clearBuildLogs(type);
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
   * Dispose of all services and clean up (async version for proper cleanup)
   */
  async dispose(): Promise<void> {
    this.watching = false;
    this.processing = false;
    this.processQueue.clear();
    this.pendingRecheck.clear();

    // Wait for all services to dispose, even if some fail
    await Promise.allSettled([
      this.fileSystemService?.dispose(),
      this.stateService?.dispose(),
      this.databaseService?.dispose(),
    ]);

    this.removeAllListeners();
  }

  /**
   * Async dispose for await using statement - ensures cleanup completes
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }

  /**
   * Synchronous dispose for using statement - schedules async cleanup
   * Note: For proper cleanup, prefer await using with Symbol.asyncDispose
   */
  [Symbol.dispose](): void {
    void this.dispose();
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
