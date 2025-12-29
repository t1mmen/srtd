/**
 * StateService - Centralized state management for template status
 * Single source of truth for all template states and transitions
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuildLog, TemplateBuildState } from '../types.js';
import { type ValidationWarning, validateBuildLog } from '../utils/schemas.js';

/**
 * Template states in the state machine
 */
export enum TemplateState {
  UNSEEN = 'unseen',
  SYNCED = 'synced',
  CHANGED = 'changed',
  APPLIED = 'applied',
  BUILT = 'built',
  ERROR = 'error',
}

/**
 * Template state information
 */
export interface TemplateStateInfo {
  state: TemplateState;
  templatePath: string;
  currentHash?: string;
  lastAppliedHash?: string;
  lastBuiltHash?: string;
  lastAppliedDate?: string;
  lastBuiltDate?: string;
  lastError?: string;
  metadata?: TemplateBuildState;
}

/**
 * State transition event
 */
export interface StateTransitionEvent {
  templatePath: string;
  fromState: TemplateState;
  toState: TemplateState;
  timestamp: string;
}

/**
 * Configuration for StateService
 */
export interface StateServiceConfig {
  baseDir: string;
  buildLogPath?: string;
  localBuildLogPath?: string;
  autoSave?: boolean;
}

/**
 * Valid state transitions matrix
 */
const VALID_TRANSITIONS: Record<TemplateState, TemplateState[]> = {
  [TemplateState.UNSEEN]: [
    TemplateState.UNSEEN, // Allow self-transition for updates
    TemplateState.SYNCED,
    TemplateState.CHANGED,
    TemplateState.APPLIED, // Allow direct apply for new templates
    TemplateState.BUILT, // Allow direct build for new templates
    TemplateState.ERROR,
  ],
  [TemplateState.SYNCED]: [
    TemplateState.SYNCED, // Allow self-transition for updates
    TemplateState.CHANGED,
    TemplateState.APPLIED,
    TemplateState.BUILT,
    TemplateState.ERROR,
  ],
  [TemplateState.CHANGED]: [
    TemplateState.CHANGED, // Allow self-transition for updates
    TemplateState.SYNCED,
    TemplateState.APPLIED,
    TemplateState.BUILT,
    TemplateState.ERROR,
  ],
  [TemplateState.APPLIED]: [
    TemplateState.APPLIED, // Allow self-transition for force apply
    TemplateState.SYNCED,
    TemplateState.CHANGED,
    TemplateState.BUILT,
    TemplateState.ERROR,
  ],
  [TemplateState.BUILT]: [
    TemplateState.BUILT, // Allow self-transition for force rebuild
    TemplateState.SYNCED,
    TemplateState.CHANGED,
    TemplateState.APPLIED,
    TemplateState.ERROR,
  ],
  [TemplateState.ERROR]: [
    TemplateState.ERROR, // Allow self-transition for updating error details
    TemplateState.UNSEEN,
    TemplateState.SYNCED,
    TemplateState.CHANGED,
    TemplateState.APPLIED,
    TemplateState.BUILT,
  ],
};

export class StateService extends EventEmitter {
  private config: StateServiceConfig;
  private templateStates: Map<string, TemplateStateInfo> = new Map();
  private buildLog: BuildLog;
  private localBuildLog: BuildLog;
  private saveTimer: NodeJS.Timeout | null = null;
  private validationWarnings: ValidationWarning[] = [];

  constructor(config: StateServiceConfig) {
    super();
    this.config = config;
    this.buildLog = this.createEmptyBuildLog();
    this.localBuildLog = this.createEmptyBuildLog();
  }

  /**
   * Initialize the service by loading existing build logs
   */
  async initialize(): Promise<void> {
    await this.loadBuildLogs();
    this.syncStatesToMemory();
  }

  /**
   * Create an empty build log
   */
  private createEmptyBuildLog(): BuildLog {
    return {
      version: '1.0',
      lastTimestamp: '',
      templates: {},
    };
  }

  /**
   * Load build logs from disk
   */
  private async loadBuildLogs(): Promise<void> {
    const buildLogPath =
      this.config.buildLogPath || path.join(this.config.baseDir, '.buildlog.json');
    const localBuildLogPath =
      this.config.localBuildLogPath || path.join(this.config.baseDir, '.buildlog.local.json');

    // Reset validation warnings
    this.validationWarnings = [];

    // Load shared build log
    try {
      const content = await fs.readFile(buildLogPath, 'utf-8');
      const result = validateBuildLog(content);
      if (result.success && result.data) {
        this.buildLog = result.data;
      } else {
        const warning: ValidationWarning = {
          source: 'buildLog',
          type: result.errorType ?? 'validation',
          message: result.error ?? 'Validation failed',
          path: buildLogPath,
        };
        this.validationWarnings.push(warning);
        this.emit('validation:warning', warning);
        // Keep empty build log (current behavior)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.emit('error', new Error(`Failed to load build log: ${error}`));
      }
    }

    // Load local build log
    try {
      const content = await fs.readFile(localBuildLogPath, 'utf-8');
      const result = validateBuildLog(content);
      if (result.success && result.data) {
        this.localBuildLog = result.data;
      } else {
        const warning: ValidationWarning = {
          source: 'localBuildLog',
          type: result.errorType ?? 'validation',
          message: result.error ?? 'Validation failed',
          path: localBuildLogPath,
        };
        this.validationWarnings.push(warning);
        this.emit('validation:warning', warning);
        // Keep empty local build log (current behavior)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.emit('error', new Error(`Failed to load local build log: ${error}`));
      }
    }
  }

  /**
   * Save build logs to disk
   */
  async saveBuildLogs(): Promise<void> {
    const buildLogPath =
      this.config.buildLogPath || path.join(this.config.baseDir, '.buildlog.json');
    const localBuildLogPath =
      this.config.localBuildLogPath || path.join(this.config.baseDir, '.buildlog.local.json');

    try {
      await fs.writeFile(buildLogPath, JSON.stringify(this.buildLog, null, 2), 'utf-8');
      await fs.writeFile(localBuildLogPath, JSON.stringify(this.localBuildLog, null, 2), 'utf-8');
    } catch (error) {
      this.emit('error', new Error(`Failed to save build logs: ${error}`));
      throw error;
    }
  }

  /**
   * Schedule auto-save if enabled
   */
  private scheduleAutoSave(): void {
    if (!this.config.autoSave) return;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      // Catch errors to prevent unhandled promise rejection
      // saveBuildLogs() already emits 'error' event, so we just need to handle the rejection
      this.saveBuildLogs().catch(() => {
        // Error already emitted in saveBuildLogs - just prevent unhandled rejection
      });
    }, 1000); // Save after 1 second of inactivity
  }

  /**
   * Sync build log states to in-memory map
   */
  private syncStatesToMemory(): void {
    // Merge templates from both build logs
    const allTemplates = new Set([
      ...Object.keys(this.buildLog.templates),
      ...Object.keys(this.localBuildLog.templates),
    ]);

    for (const templatePath of allTemplates) {
      const remoteMeta = this.buildLog.templates[templatePath];
      const localMeta = this.localBuildLog.templates[templatePath];

      // Merge metadata with local taking precedence
      const metadata = { ...remoteMeta, ...localMeta };

      // Determine state based on metadata
      const state = this.determineStateFromMetadata(metadata);

      // Convert relative path to absolute path for storage key
      const absolutePath = path.resolve(this.config.baseDir, templatePath);

      this.templateStates.set(absolutePath, {
        state,
        templatePath: absolutePath,
        lastAppliedHash: metadata.lastAppliedHash,
        lastBuiltHash: metadata.lastBuildHash,
        lastAppliedDate: metadata.lastAppliedDate,
        lastBuiltDate: metadata.lastBuildDate,
        lastError: metadata.lastAppliedError || metadata.lastBuildError,
        metadata,
      });
    }
  }

  /**
   * Determine template state from metadata
   */
  private determineStateFromMetadata(metadata: TemplateBuildState): TemplateState {
    if (metadata.lastAppliedError || metadata.lastBuildError) {
      return TemplateState.ERROR;
    }
    if (metadata.lastBuildHash) {
      return TemplateState.BUILT;
    }
    if (metadata.lastAppliedHash) {
      return TemplateState.APPLIED;
    }
    return TemplateState.UNSEEN;
  }

  /**
   * Validate if a state transition is allowed
   */
  private validateTransition(fromState: TemplateState, toState: TemplateState): boolean {
    const allowedTransitions = VALID_TRANSITIONS[fromState];
    return allowedTransitions.includes(toState);
  }

  /**
   * Perform a state transition
   */
  private async transitionState(
    templatePath: string,
    toState: TemplateState,
    updates?: Partial<TemplateStateInfo>
  ): Promise<void> {
    const currentInfo = this.templateStates.get(templatePath) || {
      state: TemplateState.UNSEEN,
      templatePath,
    };

    if (!this.validateTransition(currentInfo.state, toState)) {
      throw new Error(
        `Invalid state transition for ${templatePath}: ${currentInfo.state} -> ${toState}`
      );
    }

    const fromState = currentInfo.state;

    // Update in-memory state
    const newInfo: TemplateStateInfo = {
      ...currentInfo,
      ...updates,
      state: toState,
      templatePath,
    };

    this.templateStates.set(templatePath, newInfo);

    // Update build logs
    const relPath = path.relative(this.config.baseDir, templatePath);
    if (toState === TemplateState.APPLIED || updates?.lastAppliedHash) {
      if (!this.localBuildLog.templates[relPath]) {
        this.localBuildLog.templates[relPath] = {};
      }
      this.localBuildLog.templates[relPath] = {
        ...this.localBuildLog.templates[relPath],
        lastAppliedHash: updates?.lastAppliedHash || newInfo.lastAppliedHash,
        lastAppliedDate: updates?.lastAppliedDate || new Date().toISOString(),
        lastAppliedError: updates?.lastError,
      };
    }

    if (toState === TemplateState.BUILT || updates?.lastBuiltHash) {
      if (!this.buildLog.templates[relPath]) {
        this.buildLog.templates[relPath] = {};
      }
      this.buildLog.templates[relPath] = {
        ...this.buildLog.templates[relPath],
        lastBuildHash: updates?.lastBuiltHash || newInfo.lastBuiltHash,
        lastBuildDate: updates?.lastBuiltDate || new Date().toISOString(),
        lastBuildError: updates?.lastError,
      };
    }

    // Emit transition event
    const event: StateTransitionEvent = {
      templatePath,
      fromState,
      toState,
      timestamp: new Date().toISOString(),
    };

    this.emit('state:transition', event);
    this.scheduleAutoSave();
  }

  /**
   * Get the current state of a template
   */
  getTemplateStatus(templatePath: string): TemplateStateInfo | undefined {
    return this.templateStates.get(templatePath);
  }

  /**
   * Get all template statuses
   */
  getAllTemplateStatuses(): Map<string, TemplateStateInfo> {
    return new Map(this.templateStates);
  }

  /**
   * Get validation warnings from initialization
   * Returns any warnings about corrupted or invalid build log files
   */
  getValidationWarnings(): ValidationWarning[] {
    return [...this.validationWarnings];
  }

  /**
   * Get recently applied templates sorted by date (most recent first)
   * Returns templates from local build log that have lastAppliedDate
   */
  getRecentlyApplied(limit = 5): Array<{ template: string; appliedDate: string }> {
    const entries: Array<{ template: string; appliedDate: string }> = [];

    for (const [template, state] of Object.entries(this.localBuildLog.templates)) {
      if (state.lastAppliedDate) {
        entries.push({ template, appliedDate: state.lastAppliedDate });
      }
    }

    // Sort by date descending (most recent first)
    entries.sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());

    return entries.slice(0, limit);
  }

  /**
   * Get recent activity for watch mode history display.
   * Returns the most recent builds and applies sorted by date.
   */
  getRecentActivity(limit = 10): Array<{
    template: string;
    action: 'built' | 'applied';
    timestamp: Date;
    target?: string;
  }> {
    const entries: Array<{
      template: string;
      action: 'built' | 'applied';
      timestamp: Date;
      target?: string;
    }> = [];

    // Collect builds from buildLog
    for (const [template, state] of Object.entries(this.buildLog.templates)) {
      if (state.lastBuildDate) {
        entries.push({
          template,
          action: 'built',
          timestamp: new Date(state.lastBuildDate),
          target: state.lastMigrationFile,
        });
      }
    }

    // Collect applies from localBuildLog
    for (const [template, state] of Object.entries(this.localBuildLog.templates)) {
      if (state.lastAppliedDate) {
        entries.push({
          template,
          action: 'applied',
          timestamp: new Date(state.lastAppliedDate),
        });
      }
    }

    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return entries.slice(0, limit);
  }

  /**
   * Get template info including migration file and last date
   * Used for displaying arrow format: template.sql → migration_file.sql
   * Accepts either a full path, relative path, or just the template name
   */
  getTemplateInfo(templatePath: string): {
    template: string;
    migrationFile?: string;
    lastDate?: string;
  } {
    // Try direct lookup first (relative path from project root)
    const relativePath = path.relative(this.config.baseDir, templatePath);
    let buildState = this.buildLog.templates[relativePath];
    let localState = this.localBuildLog.templates[relativePath];
    let matchedPath = relativePath;

    // If not found, search by template name (for when just "test" is passed)
    if (!buildState && !localState) {
      const searchName = templatePath.endsWith('.sql') ? templatePath : `${templatePath}.sql`;
      for (const [storedPath, state] of Object.entries(this.buildLog.templates)) {
        if (storedPath.endsWith(searchName) || storedPath.endsWith(`/${searchName}`)) {
          buildState = state;
          matchedPath = storedPath;
          localState = this.localBuildLog.templates[storedPath];
          break;
        }
      }
      // Also check local build log if nothing found in main build log
      if (!buildState && !localState) {
        for (const [storedPath, state] of Object.entries(this.localBuildLog.templates)) {
          if (storedPath.endsWith(searchName) || storedPath.endsWith(`/${searchName}`)) {
            localState = state;
            matchedPath = storedPath;
            break;
          }
        }
      }
    }

    // Prefer build state for migration file (that's where builds write it)
    // Use either build or apply date, whichever is more recent
    const migrationFile = buildState?.lastMigrationFile;
    const buildDate = buildState?.lastBuildDate;
    const applyDate = localState?.lastAppliedDate;

    // Use the most recent date
    let lastDate: string | undefined;
    if (buildDate && applyDate) {
      lastDate = new Date(buildDate) > new Date(applyDate) ? buildDate : applyDate;
    } else {
      lastDate = buildDate || applyDate;
    }

    return {
      template: matchedPath,
      migrationFile,
      lastDate,
    };
  }

  /**
   * Check if template has changed based on hash comparison
   */
  hasTemplateChanged(templatePath: string, currentHash: string): boolean {
    const info = this.templateStates.get(templatePath);
    if (!info) return true;

    return currentHash !== info.lastAppliedHash && currentHash !== info.lastBuiltHash;
  }

  /**
   * Mark template as unseen (new template)
   */
  async markAsUnseen(templatePath: string, currentHash?: string): Promise<void> {
    await this.transitionState(templatePath, TemplateState.UNSEEN, {
      currentHash,
    });
  }

  /**
   * Mark template as synced
   */
  async markAsSynced(templatePath: string, currentHash: string): Promise<void> {
    await this.transitionState(templatePath, TemplateState.SYNCED, {
      currentHash,
    });
  }

  /**
   * Mark template as changed
   */
  async markAsChanged(templatePath: string, currentHash: string): Promise<void> {
    await this.transitionState(templatePath, TemplateState.CHANGED, {
      currentHash,
    });
  }

  /**
   * Mark template as applied
   */
  async markAsApplied(templatePath: string, hash: string): Promise<void> {
    await this.transitionState(templatePath, TemplateState.APPLIED, {
      lastAppliedHash: hash,
      lastAppliedDate: new Date().toISOString(),
      currentHash: hash,
      lastError: undefined, // Clear any previous errors on successful apply
    });
  }

  /**
   * Mark template as built
   */
  async markAsBuilt(templatePath: string, hash: string, migrationFile?: string): Promise<void> {
    const relPath = path.relative(this.config.baseDir, templatePath);

    await this.transitionState(templatePath, TemplateState.BUILT, {
      lastBuiltHash: hash,
      lastBuiltDate: new Date().toISOString(),
      currentHash: hash,
      lastError: undefined, // Clear any previous errors on successful build
    });

    // Update migration file reference
    if (migrationFile) {
      this.buildLog.templates[relPath] = {
        ...this.buildLog.templates[relPath],
        lastMigrationFile: migrationFile,
      };
    }
  }

  /**
   * Mark template as having an error
   */
  async markAsError(
    templatePath: string,
    error: string,
    type: 'apply' | 'build' = 'apply'
  ): Promise<void> {
    const updates: Partial<TemplateStateInfo> = {
      lastError: error,
    };

    const relPath = path.relative(this.config.baseDir, templatePath);

    if (type === 'apply') {
      this.localBuildLog.templates[relPath] = {
        ...this.localBuildLog.templates[relPath],
        lastAppliedError: error,
      };
    } else {
      this.buildLog.templates[relPath] = {
        ...this.buildLog.templates[relPath],
        lastBuildError: error,
      };
    }

    await this.transitionState(templatePath, TemplateState.ERROR, updates);
  }

  /**
   * Clear all states (reset)
   */
  async clearAllStates(): Promise<void> {
    this.templateStates.clear();
    this.buildLog = this.createEmptyBuildLog();
    this.localBuildLog = this.createEmptyBuildLog();
    await this.saveBuildLogs();
    this.emit('state:cleared');
  }

  /**
   * Clear build logs selectively
   * @param type - 'local' clears local only, 'shared' clears shared only, 'both' clears all
   */
  async clearBuildLogs(type: 'local' | 'shared' | 'both'): Promise<void> {
    if (type === 'local' || type === 'both') {
      this.localBuildLog = this.createEmptyBuildLog();
    }
    if (type === 'shared' || type === 'both') {
      this.buildLog = this.createEmptyBuildLog();
    }
    // Clear in-memory state when clearing both
    if (type === 'both') {
      this.templateStates.clear();
    }
    await this.saveBuildLogs();
    this.emit('state:cleared');
  }

  /**
   * Update template timestamp
   */
  updateTimestamp(timestamp: string): void {
    this.buildLog.lastTimestamp = timestamp;
    this.localBuildLog.lastTimestamp = timestamp;
    this.scheduleAutoSave();
  }

  /**
   * Get the last timestamp for generating migration filenames
   */
  getLastTimestamp(): string {
    return this.buildLog.lastTimestamp;
  }

  /**
   * Get combined build state for a template (merges common and local logs)
   * @see Orchestrator.getTemplateStatus - primary consumer
   */
  getTemplateBuildState(templatePath: string): TemplateBuildState | undefined {
    const relPath = this.toRelativePath(templatePath);
    const common = this.buildLog.templates[relPath];
    const local = this.localBuildLog.templates[relPath];

    if (!common && !local) return undefined;

    return { ...common, ...local };
  }

  /**
   * Get build log reference for MigrationBuilder (read-only access)
   * @see MigrationBuilder.generateAndWriteBundledMigration
   */
  getBuildLogForMigration(): Readonly<BuildLog> {
    return this.buildLog;
  }

  /**
   * Rename template entry in build logs (used when promoting WIP templates)
   * Moves the build state from old path to new path in both common and local logs
   */
  async renameTemplate(oldPath: string, newPath: string): Promise<void> {
    const oldRelPath = this.toRelativePath(oldPath);
    const newRelPath = this.toRelativePath(newPath);

    // Move entry in common build log
    if (this.buildLog.templates[oldRelPath]) {
      this.buildLog.templates[newRelPath] = this.buildLog.templates[oldRelPath];
      delete this.buildLog.templates[oldRelPath];
    }

    // Move entry in local build log
    if (this.localBuildLog.templates[oldRelPath]) {
      this.localBuildLog.templates[newRelPath] = this.localBuildLog.templates[oldRelPath];
      delete this.localBuildLog.templates[oldRelPath];
    }

    // Update in-memory state map
    const oldAbsPath = path.resolve(this.config.baseDir, oldRelPath);
    const newAbsPath = path.resolve(this.config.baseDir, newRelPath);
    const state = this.templateStates.get(oldAbsPath);
    if (state) {
      this.templateStates.delete(oldAbsPath);
      this.templateStates.set(newAbsPath, { ...state, templatePath: newAbsPath });
    }

    this.scheduleAutoSave();
  }

  /**
   * Convert template path to relative path for build log keys
   */
  private toRelativePath(templatePath: string): string {
    return path.isAbsolute(templatePath)
      ? path.relative(this.config.baseDir, templatePath)
      : templatePath;
  }

  /**
   * Dispose of the service
   */
  async dispose(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      await this.saveBuildLogs();
    }
    this.removeAllListeners();
  }
}
