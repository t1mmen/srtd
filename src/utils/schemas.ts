import { z } from 'zod';

/**
 * Format Zod validation errors into a human-readable string
 * @param error - Zod error object from safeParse
 * @returns Formatted error string with paths and messages
 */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/**
 * Unified validation warning interface for all validation issues
 * Used by StateService (buildLog/localBuildLog) and config validation
 */
export interface ValidationWarning {
  source: 'buildLog' | 'localBuildLog' | 'config';
  type: 'parse' | 'validation';
  message: string;
  path?: string;
}

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

/** Type derived from TemplateBuildStateSchema */
export type TemplateBuildState = z.infer<typeof TemplateBuildStateSchema>;

/**
 * Schema for BuildLog - contains version, lastTimestamp, and templates record
 */
export const BuildLogSchema = z.object({
  version: z.string(),
  lastTimestamp: z.string(),
  templates: z.record(z.string(), TemplateBuildStateSchema),
});

/** Type derived from BuildLogSchema */
export type BuildLog = z.infer<typeof BuildLogSchema>;

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
  migrationFilename: z.string().optional(),
  buildLog: z.string(),
  localBuildLog: z.string(),
  pgConnection: z.string(),
});

/** Type derived from CLIConfigSchema */
export type CLIConfig = z.infer<typeof CLIConfigSchema>;

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

  return {
    success: false,
    error: formatZodErrors(result.error),
  };
}
