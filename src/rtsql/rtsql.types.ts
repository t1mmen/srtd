export interface BuildLog {
  templates: {
    [templatePath: string]: {
      lastHash: string;
      lastBuilt: string;
      lastMigration: string;
    };
  };
  lastTimestamp: string;
}

export interface LocalBuildLog {
  templates: {
    [templatePath: string]: {
      lastApplied: string; // hash
      lastAppliedDate: string; // ISO date string
    };
  };
  lastTimestamp: string; // timestamp of last apply operation
}

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

export interface Template {
  name: string;
  path: string;
  status: 'unregistered' | 'registered' | 'modified';
}
