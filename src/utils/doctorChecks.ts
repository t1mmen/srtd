/**
 * Doctor checks - Pure functions for validating SRTD setup
 * Each check returns a DoctorCheckResult with name, passed status, and optional message
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_FILE } from '../constants.js';
import { DatabaseService } from '../services/DatabaseService.js';
import type { CLIConfig } from '../types.js';
import { fileExists } from './fileExists.js';
import { type ValidationWarning, validateBuildLog } from './schemas.js';

/**
 * Result of a single doctor check
 */
export interface DoctorCheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

/**
 * Check 1: Config file exists
 */
export async function checkConfigExists(projectRoot: string): Promise<DoctorCheckResult> {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  const exists = await fileExists(configPath);

  return {
    name: 'Config file exists',
    passed: exists,
    message: exists ? undefined : `srtd.config.json not found in ${projectRoot}`,
  };
}

/**
 * Check 2: Config schema is valid
 */
export async function checkConfigSchemaValid(
  warnings: ValidationWarning[]
): Promise<DoctorCheckResult> {
  // Filter to only config-related warnings
  const configWarnings = warnings.filter(w => w.source === 'config');

  if (configWarnings.length === 0) {
    return {
      name: 'Config schema valid',
      passed: true,
    };
  }

  return {
    name: 'Config schema valid',
    passed: false,
    message: configWarnings.map(w => w.message).join('; '),
  };
}

/**
 * Check 3: Template directory exists
 */
export async function checkTemplateDirExists(
  projectRoot: string,
  config: CLIConfig
): Promise<DoctorCheckResult> {
  const templatePath = path.join(projectRoot, config.templateDir);
  const exists = await fileExists(templatePath);

  return {
    name: 'Template directory exists',
    passed: exists,
    message: exists ? undefined : `Template directory not found: ${config.templateDir}`,
  };
}

/**
 * Check 4: Migration directory exists
 */
export async function checkMigrationDirExists(
  projectRoot: string,
  config: CLIConfig
): Promise<DoctorCheckResult> {
  const migrationPath = path.join(projectRoot, config.migrationDir);
  const exists = await fileExists(migrationPath);

  return {
    name: 'Migration directory exists',
    passed: exists,
    message: exists ? undefined : `Migration directory not found: ${config.migrationDir}`,
  };
}

/**
 * Check 5: Template directory is readable
 */
export async function checkTemplateDirReadable(
  projectRoot: string,
  config: CLIConfig
): Promise<DoctorCheckResult> {
  const templatePath = path.join(projectRoot, config.templateDir);

  try {
    await fs.readdir(templatePath);
    return {
      name: 'Template directory readable',
      passed: true,
    };
  } catch (error) {
    return {
      name: 'Template directory readable',
      passed: false,
      message: error instanceof Error ? error.message : 'Cannot read template directory',
    };
  }
}

/**
 * Check 6: Migration directory is writable
 */
export async function checkMigrationDirWritable(
  projectRoot: string,
  config: CLIConfig
): Promise<DoctorCheckResult> {
  const migrationPath = path.join(projectRoot, config.migrationDir);
  const testFile = path.join(migrationPath, '.srtd-doctor-test');

  let fileWritten = false;
  try {
    await fs.writeFile(testFile, 'test');
    fileWritten = true;
    return {
      name: 'Migration directory writable',
      passed: true,
    };
  } catch (error) {
    return {
      name: 'Migration directory writable',
      passed: false,
      message: error instanceof Error ? error.message : 'Cannot write to migration directory',
    };
  } finally {
    // Cleanup test file if it was written (ignore cleanup errors)
    if (fileWritten) {
      await fs.unlink(testFile).catch(() => {
        // Intentionally ignore - cleanup failure doesn't affect writability result
      });
    }
  }
}

/**
 * Check 7: Build log is valid (if exists)
 */
export async function checkBuildLogValid(
  projectRoot: string,
  config: CLIConfig
): Promise<DoctorCheckResult> {
  const buildLogPath = path.join(projectRoot, config.buildLog);

  try {
    const content = await fs.readFile(buildLogPath, 'utf-8');
    const result = validateBuildLog(content);

    if (result.success) {
      return {
        name: 'Build log valid',
        passed: true,
      };
    }

    return {
      name: 'Build log valid',
      passed: false,
      message: `Invalid build log: ${result.error}`,
    };
  } catch (error) {
    // File not found is OK - build log is optional until first build
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {
        name: 'Build log valid',
        passed: true,
      };
    }

    return {
      name: 'Build log valid',
      passed: false,
      message: error instanceof Error ? error.message : 'Cannot read build log',
    };
  }
}

/**
 * Check 8: Local build log is valid (if exists)
 */
export async function checkLocalBuildLogValid(
  projectRoot: string,
  config: CLIConfig
): Promise<DoctorCheckResult> {
  const localBuildLogPath = path.join(projectRoot, config.localBuildLog);

  try {
    const content = await fs.readFile(localBuildLogPath, 'utf-8');
    const result = validateBuildLog(content);

    if (result.success) {
      return {
        name: 'Local build log valid',
        passed: true,
      };
    }

    return {
      name: 'Local build log valid',
      passed: false,
      message: `Invalid local build log: ${result.error}`,
    };
  } catch (error) {
    // File not found is OK - local build log is optional
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {
        name: 'Local build log valid',
        passed: true,
      };
    }

    return {
      name: 'Local build log valid',
      passed: false,
      message: error instanceof Error ? error.message : 'Cannot read local build log',
    };
  }
}

/**
 * Check 9: Database connection works
 */
export async function checkDatabaseConnection(
  config: CLIConfig,
  timeoutMs = 5000
): Promise<DoctorCheckResult> {
  const db = DatabaseService.fromConfig(config);

  try {
    // Race between testConnection and timeout
    const timeoutPromise = new Promise<'timeout'>(resolve => {
      setTimeout(() => resolve('timeout'), timeoutMs);
    });

    const connectionPromise = db.testConnection();

    const result = await Promise.race([connectionPromise, timeoutPromise]);

    if (result === 'timeout') {
      return {
        name: 'Database connection',
        passed: false,
        message: `Connection timed out after ${timeoutMs}ms`,
      };
    }

    if (result === true) {
      return {
        name: 'Database connection',
        passed: true,
      };
    }

    return {
      name: 'Database connection',
      passed: false,
      message: 'Connection failed. Check database server is running.',
    };
  } catch (error) {
    return {
      name: 'Database connection',
      passed: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  } finally {
    await db.dispose();
  }
}

/**
 * Check 10: At least one SQL template exists
 */
export async function checkTemplateCount(
  projectRoot: string,
  config: CLIConfig
): Promise<DoctorCheckResult> {
  const templatePath = path.join(projectRoot, config.templateDir);

  try {
    const files = await fs.readdir(templatePath);
    const sqlFiles = files.filter(f => f.endsWith('.sql'));

    if (sqlFiles.length >= 1) {
      return {
        name: 'Template count',
        passed: true,
      };
    }

    return {
      name: 'Template count',
      passed: false,
      message: `No SQL templates found in ${config.templateDir}`,
    };
  } catch {
    return {
      name: 'Template count',
      passed: false,
      message: `Cannot read template directory: ${config.templateDir}`,
    };
  }
}

/**
 * Run all 10 doctor checks in order
 */
export async function runAllChecks(
  projectRoot: string,
  config: CLIConfig,
  warnings: ValidationWarning[]
): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];

  // Run checks in order
  results.push(await checkConfigExists(projectRoot));
  results.push(await checkConfigSchemaValid(warnings));
  results.push(await checkTemplateDirExists(projectRoot, config));
  results.push(await checkMigrationDirExists(projectRoot, config));
  results.push(await checkTemplateDirReadable(projectRoot, config));
  results.push(await checkMigrationDirWritable(projectRoot, config));
  results.push(await checkBuildLogValid(projectRoot, config));
  results.push(await checkLocalBuildLogValid(projectRoot, config));
  results.push(await checkDatabaseConnection(config));
  results.push(await checkTemplateCount(projectRoot, config));

  return results;
}
