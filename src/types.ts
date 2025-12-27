// types.ts
// Import types derived from Zod schemas for local use
import type { TemplateBuildState } from './utils/schemas.js';

// Re-export types derived from Zod schemas (single source of truth)
export type { BuildLog, CLIConfig, TemplateBuildState } from './utils/schemas.js';

export interface MigrationError {
  file: string;
  error: string;
  templateName: string;
}

export interface ProcessedTemplateResult {
  errors: MigrationError[];
  applied: string[];
  built: string[];
  skipped: string[];
}

export interface TemplateStatus {
  name: string;
  path: string;
  currentHash: string;
  migrationHash: string | null;
  buildState: TemplateBuildState;
  wip: boolean;
}
