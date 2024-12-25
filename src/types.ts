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

export interface BuildLog {
  version: string; // Format version
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

export interface RTSQLConfig {
  templateDir: string;
  migrationDir: string;
  buildLog: string;
  localBuildLog: string;
  pgConnection: string;
}

export type RTSQLConfigPartial = Partial<RTSQLConfig>;

export interface RTSQLArgs {
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
  currentHash: string;
  migrationHash: string | null;
  buildState: TemplateBuildState;
}

export enum TemplateState {
  WIP = 'WIP',
  UNREGISTERED = 'UNREGISTERED',
  REGISTERED = 'REGISTERED',
  MODIFIED = 'MODIFIED',
}

export enum BuildStatus {
  NOT_BUILT = 'NOT_BUILT',
  BUILT = 'BUILT',
  MODIFIED = 'MODIFIED',
  ERROR = 'ERROR',
}

export enum ApplyStatus {
  NOT_APPLIED = 'NOT_APPLIED',
  APPLIED = 'APPLIED',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
}

export interface TemplateStateInfo {
  state: TemplateState;
  buildStatus: BuildStatus;
  applyStatus: ApplyStatus;
  currentHash: string;
  buildMessage?: string;
  applyMessage?: string;
}
