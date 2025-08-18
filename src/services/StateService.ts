/**
 * StateService - Centralized state management for template status
 * Single source of truth for all template states and transitions
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuildLog, TemplateBuildState } from '../types.js';

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
  [TemplateState.UNSEEN]: [TemplateState.SYNCED, TemplateState.CHANGED, TemplateState.ERROR],
  [TemplateState.SYNCED]: [
    TemplateState.CHANGED,
    TemplateState.APPLIED,
    TemplateState.BUILT,
    TemplateState.ERROR,
  ],
  [TemplateState.CHANGED]: [
    TemplateState.SYNCED,
    TemplateState.APPLIED,
    TemplateState.BUILT,
    TemplateState.ERROR,
  ],
  [TemplateState.APPLIED]: [
    TemplateState.SYNCED,
    TemplateState.CHANGED,
    TemplateState.BUILT,
    TemplateState.ERROR,
  ],
  [TemplateState.BUILT]: [
    TemplateState.SYNCED,
    TemplateState.CHANGED,
    TemplateState.APPLIED,
    TemplateState.ERROR,
  ],
  [TemplateState.ERROR]: [
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

    // Load remote build log
    try {
      const content = await fs.readFile(buildLogPath, 'utf-8');
      this.buildLog = JSON.parse(content);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        this.emit('error', new Error(`Failed to load build log: ${error}`));
      }
    }

    // Load local build log
    try {
      const content = await fs.readFile(localBuildLogPath, 'utf-8');
      this.localBuildLog = JSON.parse(content);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
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
      void this.saveBuildLogs();
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

      this.templateStates.set(templatePath, {
        state,
        templatePath,
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
      lastError: undefined,
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
      lastError: undefined,
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
   * Update template timestamp
   */
  updateTimestamp(timestamp: string): void {
    this.buildLog.lastTimestamp = timestamp;
    this.localBuildLog.lastTimestamp = timestamp;
    this.scheduleAutoSave();
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
