/**
 * FileSystemService - Handles all file system operations for templates
 * Decoupled from business logic, only handles raw file operations
 */

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FSWatcher } from 'chokidar';
import { glob } from 'glob';

export interface FileSystemConfig {
  baseDir: string;
  templateDir: string;
  filter: string;
  migrationDir: string;
  watchOptions?: {
    ignoreInitial?: boolean;
    stabilityThreshold?: number;
    pollInterval?: number;
  };
}

export interface TemplateFile {
  path: string;
  name: string;
  content: string;
  hash: string;
  relativePath: string;
}

export interface WatchEvent {
  type: 'added' | 'changed' | 'removed';
  path: string;
  relativePath: string;
  name: string;
}

export class FileSystemService extends EventEmitter {
  private config: FileSystemConfig;
  private watcher: FSWatcher | null = null;
  private debouncedHandlers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: FileSystemConfig) {
    super();
    this.config = config;
  }

  /**
   * Find all template files matching the configured pattern
   */
  async findTemplates(): Promise<string[]> {
    const templatePath = path.join(
      this.config.baseDir,
      this.config.templateDir,
      this.config.filter
    );
    const matches = await glob(templatePath);
    return matches.sort(); // Ensure consistent ordering
  }

  /**
   * Read a template file and return its content with metadata
   */
  async readTemplate(templatePath: string): Promise<TemplateFile> {
    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      const hash = this.calculateHash(content);
      const name = path.basename(templatePath, '.sql');
      const relativePath = path.relative(this.config.baseDir, templatePath);

      return {
        path: templatePath,
        name,
        content,
        hash,
        relativePath,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Template file not found: ${templatePath}`);
      }
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // File doesn't exist, ignore
        return;
      }
      throw error;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string): Promise<Stats> {
    return fs.stat(filePath);
  }

  /**
   * Calculate MD5 hash of content
   */
  private calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Watch templates for changes
   */
  async watchTemplates(): Promise<void> {
    if (this.watcher) {
      throw new Error('Already watching templates');
    }

    const chokidar = await import('chokidar');
    const templatePath = path.join(this.config.baseDir, this.config.templateDir);

    const watchOptions = {
      ignoreInitial: this.config.watchOptions?.ignoreInitial ?? false,
      ignored: ['**/!(*.sql)'],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.watchOptions?.stabilityThreshold ?? 200,
        pollInterval: this.config.watchOptions?.pollInterval ?? 100,
      },
    };

    this.watcher = chokidar.watch(templatePath, watchOptions);

    // Handle initial files if not ignoring
    if (!watchOptions.ignoreInitial) {
      const existingFiles = await this.findTemplates();
      for (const file of existingFiles) {
        this.emitWatchEvent('added', file);
      }
    }

    // Set up event handlers with debouncing
    this.watcher
      .on('add', (filepath: string) => {
        if (path.extname(filepath) === '.sql') {
          this.debouncedEmit('added', filepath);
        }
      })
      .on('change', (filepath: string) => {
        if (path.extname(filepath) === '.sql') {
          this.debouncedEmit('changed', filepath);
        }
      })
      .on('unlink', (filepath: string) => {
        if (path.extname(filepath) === '.sql') {
          this.debouncedEmit('removed', filepath);
        }
      })
      .on('error', (error: unknown) => {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      });
  }

  /**
   * Stop watching templates
   */
  async stopWatching(): Promise<void> {
    // Clear any pending debounced handlers
    for (const timer of this.debouncedHandlers.values()) {
      clearTimeout(timer);
    }
    this.debouncedHandlers.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Emit watch event with debouncing
   */
  private debouncedEmit(type: WatchEvent['type'], filepath: string): void {
    const key = `${type}:${filepath}`;

    // Clear existing timer for this event
    const existingTimer = this.debouncedHandlers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.emitWatchEvent(type, filepath);
      this.debouncedHandlers.delete(key);
    }, 100);

    this.debouncedHandlers.set(key, timer);
  }

  /**
   * Emit a watch event
   */
  private emitWatchEvent(type: WatchEvent['type'], filepath: string): void {
    const relativePath = path.relative(this.config.baseDir, filepath);
    const name = path.basename(filepath, '.sql');

    const event: WatchEvent = {
      type,
      path: filepath,
      relativePath,
      name,
    };

    // Emit specific event types
    switch (type) {
      case 'added':
        this.emit('template:added', event);
        break;
      case 'changed':
        this.emit('template:changed', event);
        break;
      case 'removed':
        this.emit('template:removed', event);
        break;
    }

    // Also emit generic event
    this.emit('template:event', event);
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.stopWatching();
    this.removeAllListeners();
  }

  /**
   * Get migration file path for a template
   */
  getMigrationPath(templateName: string, timestamp: string): string {
    const migrationName = `${timestamp}_${templateName}.sql`;
    return path.join(this.config.baseDir, this.config.migrationDir, migrationName);
  }

  /**
   * List all migration files
   */
  async listMigrations(): Promise<string[]> {
    const migrationPath = path.join(this.config.baseDir, this.config.migrationDir, '*.sql');
    const matches = await glob(migrationPath);
    return matches.sort(); // Ensure chronological order
  }

  /**
   * Read a migration file
   */
  async readMigration(migrationPath: string): Promise<string> {
    return fs.readFile(migrationPath, 'utf-8');
  }
}
