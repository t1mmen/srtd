import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockConsoleLog } from '../../__tests__/helpers/testUtils.js';
import type { ValidationWarning } from '../../services/StateService.js';
import type { ValidationWarning as ConfigValidationWarning } from '../../utils/config.js';
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
    displayValidationWarnings([], []);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('displays state service validation warnings', () => {
    const stateWarnings: ValidationWarning[] = [
      {
        file: 'buildLog',
        path: '/path/to/buildlog.json',
        error: 'Invalid JSON format',
      },
    ];

    displayValidationWarnings(stateWarnings, []);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Validation Warnings');
    expect(output).toContain('buildLog');
    expect(output).toContain('Invalid JSON format');
  });

  it('displays config validation warnings', () => {
    const configWarnings: ConfigValidationWarning[] = [
      {
        type: 'parse',
        message: 'Invalid JSON in config',
        path: '/path/to/config.json',
      },
    ];

    displayValidationWarnings([], configWarnings);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Validation Warnings');
    expect(output).toContain('Invalid JSON in config');
  });

  it('displays both state and config warnings together', () => {
    const stateWarnings: ValidationWarning[] = [
      {
        file: 'localBuildLog',
        path: '/path/to/local.json',
        error: 'Schema validation failed',
      },
    ];
    const configWarnings: ConfigValidationWarning[] = [
      {
        type: 'validation',
        message: 'Unknown field in config',
        path: '/path/to/config.json',
      },
    ];

    displayValidationWarnings(stateWarnings, configWarnings);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Validation Warnings');
    expect(output).toContain('Schema validation failed');
    expect(output).toContain('Unknown field in config');
  });

  it('displays path information when available', () => {
    const stateWarnings: ValidationWarning[] = [
      {
        file: 'buildLog',
        path: '/project/supabase/.buildlog.json',
        error: 'Corrupted file',
      },
    ];

    displayValidationWarnings(stateWarnings, []);

    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('/project/supabase/.buildlog.json');
  });
});
