/**
 * MigrationBuilder Service - Generates Supabase migration files from templates
 * Pure service that takes template content and metadata and produces formatted migration files
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuildLog, CLIConfig } from '../types.js';
import { getNextTimestamp } from '../utils/getNextTimestamp.js';
import { interpolateMigrationFilename } from '../utils/interpolateMigrationFilename.js';

export interface TemplateMetadata {
  name: string;
  templatePath: string;
  relativePath: string;
  content: string;
  hash: string;
  lastBuildAt?: string;
}

export interface MigrationOptions {
  force?: boolean;
  wrapInTransaction?: boolean;
  bundleMode?: boolean;
  templateName?: string;
}

export interface MigrationResult {
  fileName: string;
  filePath: string;
  content: string;
  timestamp: string;
  /** The new lastTimestamp to store in the build log */
  newLastTimestamp: string;
}

export interface BundleMigrationResult {
  fileName: string;
  filePath: string;
  content: string;
  timestamp: string;
  /** The new lastTimestamp to store in the build log */
  newLastTimestamp: string;
  includedTemplates: string[];
}

export interface MigrationBuilderConfig {
  baseDir: string;
  templateDir: string;
  migrationDir: string;
  migrationPrefix?: string;
  migrationFilename?: string;
  banner?: string;
  footer?: string;
  wrapInTransaction?: boolean;
}

/** Internal config with all optional fields resolved to required values */
type ResolvedMigrationBuilderConfig = Required<MigrationBuilderConfig>;

export class MigrationBuilder {
  private config: ResolvedMigrationBuilderConfig;

  constructor(config: MigrationBuilderConfig) {
    this.config = {
      migrationPrefix: '',
      migrationFilename: '$timestamp_$prefix$migrationName.sql',
      banner: '',
      footer: '',
      wrapInTransaction: true,
      ...config,
    };
  }

  /**
   * Generate a migration file from a single template.
   * Note: Caller is responsible for updating the build log with newLastTimestamp.
   */
  generateMigration(
    template: TemplateMetadata,
    buildLog: BuildLog,
    options: MigrationOptions = {}
  ): MigrationResult {
    const { timestamp, newLastTimestamp } = getNextTimestamp(buildLog.lastTimestamp);
    const fileName = interpolateMigrationFilename({
      template: this.config.migrationFilename,
      timestamp,
      migrationName: template.name,
      prefix: this.config.migrationPrefix,
    });
    const filePath = path.join(this.config.migrationDir, fileName);

    // Validate path stays within migration directory (prevent path traversal)
    this.validateMigrationPath(filePath);

    const content = this.formatMigrationContent(template, {
      isBundled: false,
      ...options,
    });

    return {
      fileName,
      filePath,
      content,
      timestamp,
      newLastTimestamp,
    };
  }

  /**
   * Generate a bundled migration file from multiple templates.
   * Note: Caller is responsible for updating the build log with newLastTimestamp.
   */
  generateBundledMigration(
    templates: TemplateMetadata[],
    buildLog: BuildLog,
    options: MigrationOptions = {}
  ): BundleMigrationResult {
    const { timestamp, newLastTimestamp } = getNextTimestamp(buildLog.lastTimestamp);
    const fileName = interpolateMigrationFilename({
      template: this.config.migrationFilename,
      timestamp,
      migrationName: 'bundle',
      prefix: this.config.migrationPrefix,
    });
    const filePath = path.join(this.config.migrationDir, fileName);

    // Validate path stays within migration directory (prevent path traversal)
    this.validateMigrationPath(filePath);

    let content = '';
    const includedTemplates: string[] = [];

    for (const template of templates) {
      const templateContent = this.formatMigrationContent(template, {
        isBundled: true,
        ...options,
      });
      content += `${templateContent}\n\n`;
      includedTemplates.push(template.name);
    }

    return {
      fileName,
      filePath,
      content: content.trim(),
      timestamp,
      newLastTimestamp,
      includedTemplates,
    };
  }

  /**
   * Format migration content with headers, footers, and transaction wrapping
   */
  private formatMigrationContent(
    template: TemplateMetadata,
    options: MigrationOptions & { isBundled?: boolean } = {}
  ): string {
    const { isBundled = false, wrapInTransaction = this.config.wrapInTransaction } = options;

    // Generate header
    const headerPrefix = isBundled ? 'Template' : 'Generated with srtd from template';
    const header = `-- ${headerPrefix}: ${this.config.templateDir}/${template.name}.sql\n`;

    // Generate banner
    const banner = this.config.banner ? `-- ${this.config.banner}\n` : '\n';

    // Generate footer
    const lastBuildInfo = template.lastBuildAt || 'Never';
    const footerText = this.config.footer ? `${this.config.footer}\n` : '';
    const footer = `${footerText}-- Last built: ${lastBuildInfo}\n-- Built with https://github.com/t1mmen/srtd\n`;

    // Wrap content in transaction if needed
    const safeContent = wrapInTransaction
      ? `BEGIN;\n\n${template.content}\n\nCOMMIT;`
      : template.content;

    // Assemble final content
    return `${header}${banner}\n${safeContent}\n${footer}`;
  }

  /**
   * Create MigrationBuilder from CLI config
   */
  static fromConfig(config: CLIConfig, baseDir: string): MigrationBuilder {
    // Only include defined properties to allow constructor defaults to apply
    return new MigrationBuilder({
      baseDir,
      templateDir: config.templateDir,
      migrationDir: config.migrationDir,
      ...(config.migrationPrefix !== undefined && { migrationPrefix: config.migrationPrefix }),
      ...(config.migrationFilename !== undefined && {
        migrationFilename: config.migrationFilename,
      }),
      ...(config.banner !== undefined && { banner: config.banner }),
      ...(config.footer !== undefined && { footer: config.footer }),
      ...(config.wrapInTransaction !== undefined && {
        wrapInTransaction: config.wrapInTransaction,
      }),
    });
  }

  /**
   * Generate migration file path for a template
   */
  getMigrationPath(templateName: string, timestamp: string): string {
    const fileName = interpolateMigrationFilename({
      template: this.config.migrationFilename,
      timestamp,
      migrationName: templateName,
      prefix: this.config.migrationPrefix,
    });
    return path.join(this.config.migrationDir, fileName);
  }

  /**
   * Generate absolute migration file path for a template
   */
  getAbsoluteMigrationPath(templateName: string, timestamp: string): string {
    const migrationPath = this.getMigrationPath(templateName, timestamp);
    return path.resolve(this.config.baseDir, migrationPath);
  }

  /**
   * Validate migration configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.baseDir) {
      errors.push('baseDir is required');
    }

    if (!this.config.templateDir) {
      errors.push('templateDir is required');
    }

    if (!this.config.migrationDir) {
      errors.push('migrationDir is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate that a migration path stays within the migration directory
   * Prevents path traversal attacks via malicious template patterns
   */
  private validateMigrationPath(filePath: string): void {
    const resolvedPath = path.resolve(this.config.baseDir, filePath);
    const resolvedMigrationDir = path.resolve(this.config.baseDir, this.config.migrationDir);

    // Use path.relative() for robust cross-platform path traversal detection
    const relativePath = path.relative(resolvedMigrationDir, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(
        `Invalid migration path: "${filePath}" would write outside migration directory`
      );
    }
  }

  /**
   * Write migration file to disk
   */
  async writeMigration(migrationResult: MigrationResult): Promise<string> {
    const fullPath = path.resolve(this.config.baseDir, migrationResult.filePath);
    const directory = path.dirname(fullPath);

    // Ensure migration directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write migration file
    await fs.writeFile(fullPath, migrationResult.content, 'utf-8');

    return fullPath;
  }

  /**
   * Write bundled migration file to disk
   */
  async writeBundledMigration(migrationResult: BundleMigrationResult): Promise<string> {
    const fullPath = path.resolve(this.config.baseDir, migrationResult.filePath);
    const directory = path.dirname(fullPath);

    // Ensure migration directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write bundled migration file
    await fs.writeFile(fullPath, migrationResult.content, 'utf-8');

    return fullPath;
  }

  /**
   * Generate and write migration file in one operation.
   * Note: Caller is responsible for updating the build log with result.newLastTimestamp.
   */
  async generateAndWriteMigration(
    template: TemplateMetadata,
    buildLog: BuildLog,
    options: MigrationOptions = {}
  ): Promise<{ result: MigrationResult; filePath: string }> {
    const result = this.generateMigration(template, buildLog, options);
    const filePath = await this.writeMigration(result);
    return { result, filePath };
  }

  /**
   * Generate and write bundled migration file in one operation.
   * Note: Caller is responsible for updating the build log with result.newLastTimestamp.
   */
  async generateAndWriteBundledMigration(
    templates: TemplateMetadata[],
    buildLog: BuildLog,
    options: MigrationOptions = {}
  ): Promise<{ result: BundleMigrationResult; filePath: string }> {
    const result = this.generateBundledMigration(templates, buildLog, options);
    const filePath = await this.writeBundledMigration(result);
    return { result, filePath };
  }

  /**
   * Check if migration file already exists
   */
  async migrationExists(fileName: string): Promise<boolean> {
    const fullPath = path.resolve(this.config.baseDir, this.config.migrationDir, fileName);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<MigrationBuilderConfig> {
    return { ...this.config };
  }
}
