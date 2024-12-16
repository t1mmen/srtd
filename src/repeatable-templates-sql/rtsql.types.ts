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
      lastApplied: string;
    };
  };
}

export interface BuildModes {
  force: boolean;
  apply: boolean;
  skipFiles: boolean;
  filter?: boolean;
  register?: string;
  verbose?: boolean;
}

export interface MigrationError {
  file: string;
  error: string;
  templateName: string;
}
