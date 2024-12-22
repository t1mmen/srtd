export interface TemplateBuildState {
  // Build info
  lastBuildHash?: string;
  lastBuildDate?: string;
  lastBuildError?: string;
  lastMigrationFile?: string;

  // Apply info
  lastAppliedHash?: string;
  lastAppliedDate?: string;
  lastAppliedError?: string;
}

export interface BuildLogBase {
  version: string; // Format version
  lastTimestamp: string;
  templates: {
    [templatePath: string]: TemplateBuildState;
  };
}

// For backward compatibility and type safety
export type BuildLog = BuildLogBase;
export type LocalBuildLog = BuildLogBase;

export interface MigrationError {
  file: string;
  error: string;
  templateName: string;
}

export interface RTSQLConfig {
  filter?: string;
  force?: boolean;
  apply?: boolean;
  skipFiles?: boolean;
  register?: string | string[];
  verbose?: boolean;
  baseDir?: string;
}

export interface RTSQLResult {
  errors: MigrationError[];
  applied: string[];
}

export interface TemplateStatus {
  name: string;
  path: string;
  status: 'unregistered' | 'registered' | 'modified';
  buildState: TemplateBuildState;
}
