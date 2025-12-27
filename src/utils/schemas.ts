import { z } from 'zod';
import type { BuildLog, CLIConfig } from '../types.js';

/**
 * Schema for TemplateBuildState - all fields are optional strings
 */
export const TemplateBuildStateSchema = z.object({
  lastBuildHash: z.string().optional(),
  lastBuildDate: z.string().optional(),
  lastBuildError: z.string().optional(),
  lastMigrationFile: z.string().optional(),
  lastAppliedHash: z.string().optional(),
  lastAppliedDate: z.string().optional(),
  lastAppliedError: z.string().optional(),
});

/**
 * Schema for BuildLog - contains version, lastTimestamp, and templates record
 */
export const BuildLogSchema = z.object({
  version: z.string(),
  lastTimestamp: z.string(),
  templates: z.record(z.string(), TemplateBuildStateSchema),
});

/**
 * Schema for CLIConfig - matches CLIConfig interface from types.ts
 */
export const CLIConfigSchema = z.object({
  filter: z.string(),
  wipIndicator: z.string(),
  wrapInTransaction: z.boolean(),
  banner: z.string(),
  footer: z.string(),
  templateDir: z.string(),
  migrationDir: z.string(),
  migrationPrefix: z.string().optional(),
  buildLog: z.string(),
  localBuildLog: z.string(),
  pgConnection: z.string(),
});

/**
 * Result type for validation helpers
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validates a JSON string as a BuildLog
 * @param content - JSON string to validate
 * @returns ValidationResult with parsed data or error message
 */
export function validateBuildLog(content: string): ValidationResult<BuildLog> {
  // Handle empty string
  if (!content || content.trim() === '') {
    return {
      success: false,
      error: 'Empty content provided',
    };
  }

  // Try to parse JSON first
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      success: false,
      error: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`,
    };
  }

  // Validate against schema
  const result = BuildLogSchema.safeParse(parsed);

  if (result.success) {
    return {
      success: true,
      data: result.data as BuildLog,
    };
  }

  // Format error message
  const errors = result.error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');

  return {
    success: false,
    error: errors,
  };
}

/**
 * Validates a JSON string as a CLIConfig
 * @param content - JSON string to validate
 * @returns ValidationResult with parsed data or error message
 */
export function validateConfig(content: string): ValidationResult<CLIConfig> {
  // Handle empty string
  if (!content || content.trim() === '') {
    return {
      success: false,
      error: 'Empty content provided',
    };
  }

  // Try to parse JSON first
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      success: false,
      error: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`,
    };
  }

  // Validate against schema
  const result = CLIConfigSchema.safeParse(parsed);

  if (result.success) {
    return {
      success: true,
      data: result.data as CLIConfig,
    };
  }

  // Format error message
  const errors = result.error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');

  return {
    success: false,
    error: errors,
  };
}
