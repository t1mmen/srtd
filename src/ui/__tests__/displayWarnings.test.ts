import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockConsoleLog } from '../../__tests__/helpers/testUtils.js';
import type { ValidationWarning } from '../../utils/schemas.js';
import { displayValidationWarnings } from '../displayWarnings.js';

describe('displayValidationWarnings', () => {
  let consoleLogSpy: ReturnType<typeof mockConsoleLog>;

  beforeEach(() => {
    consoleLogSpy = mockConsoleLog();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('displays nothing when there are no warnings', () => {
    displayValidationWarnings([]);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('displays buildLog validation warnings', () => {
    const warnings: ValidationWarning[] = [
      {
        source: 'buildLog',
        type: 'parse',
        message: 'Invalid JSON format',
        path: '/path/to/buildlog.json',
      },
    ];

    displayValidationWarnings(warnings);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Validation Warnings');
    expect(output).toContain('buildLog');
    expect(output).toContain('Invalid JSON format');
  });

  it('displays config validation warnings', () => {
    const warnings: ValidationWarning[] = [
      {
        source: 'config',
        type: 'parse',
        message: 'Invalid JSON in config',
        path: '/path/to/config.json',
      },
    ];

    displayValidationWarnings(warnings);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Validation Warnings');
    expect(output).toContain('config (parse)');
    expect(output).toContain('Invalid JSON in config');
  });

  it('displays both buildLog and config warnings together', () => {
    const warnings: ValidationWarning[] = [
      {
        source: 'localBuildLog',
        type: 'validation',
        message: 'Schema validation failed',
        path: '/path/to/local.json',
      },
      {
        source: 'config',
        type: 'validation',
        message: 'Unknown field in config',
        path: '/path/to/config.json',
      },
    ];

    displayValidationWarnings(warnings);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Validation Warnings');
    expect(output).toContain('Schema validation failed');
    expect(output).toContain('Unknown field in config');
  });

  it('displays path information when available', () => {
    const warnings: ValidationWarning[] = [
      {
        source: 'buildLog',
        type: 'parse',
        message: 'Corrupted file',
        path: '/project/supabase/.buildlog.json',
      },
    ];

    displayValidationWarnings(warnings);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('/project/supabase/.buildlog.json');
  });

  it('displays missing type warnings for config', () => {
    const warnings: ValidationWarning[] = [
      {
        source: 'config',
        type: 'missing',
        message: 'Template directory does not exist: supabase/migrations-templates',
        path: '/project/supabase/migrations-templates',
      },
    ];

    displayValidationWarnings(warnings);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Validation Warnings');
    expect(output).toContain('config (missing)');
    expect(output).toContain('Template directory does not exist');
  });
});
