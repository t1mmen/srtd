// types.ts
export interface TemplateBuildState {
  lastBuildHash?: string;
  lastBuildDate?: string;
  lastBuildError?: string;
  lastMigrationFile?: string;
  lastAppliedHash?: string;
  lastAppliedDate?: string;
  lastAppliedError?: string;
}

export interface BuildLog {
  version: string;
  lastTimestamp: string;
  templates: {
    [templatePath: string]: TemplateBuildState;
  };
}

export interface MigrationError {
  file: string;
  error: string;
  templateName: string;
}

export interface CLIConfig {
  filter: string;
  wipIndicator: string;
  wrapInTransaction: boolean;
  banner: string;
  footer: string;
  templateDir: string;
  migrationDir: string;
  migrationPrefix?: string;
  migrationFilename?: string;
  buildLog: string;
  localBuildLog: string;
  pgConnection: string;
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
