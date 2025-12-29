/**
 * End-to-end tests for the srtd doctor command
 *
 * Tests the diagnostic tool that validates SRTD setup.
 * Runs in the actual project directory which has a valid config.
 *
 * IMPORTANT: These tests must FAIL when CLI execution fails.
 * No silent skipping - CI must catch broken CLI builds.
 */

import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('CLI Doctor Command', () => {
  /**
   * Run doctor command and capture output
   * @returns {output: string, exitCode: number}
   */
  function runDoctor(): { output: string; exitCode: number } {
    try {
      const output = execSync('npm run start -- doctor', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // Ensure we get real output, not test mode
        env: { ...process.env, SRTD_TEST_MODE: undefined },
      });
      return { output, exitCode: 0 };
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error) {
        const exitCode = 'status' in error ? (error.status as number) : 1;
        return { output: String(error.stdout), exitCode };
      }
      throw new Error(
        `CLI doctor command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run doctor --help and capture output
   */
  function getDoctorHelp(): string {
    try {
      const output = execSync('npm run start -- doctor --help', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return output;
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error && error.stdout) {
        return String(error.stdout);
      }
      throw new Error(
        `CLI doctor --help failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  it('should show help for doctor command', () => {
    const help = getDoctorHelp();

    expect(help).toContain('Usage:');
    expect(help).toContain('doctor');
    expect(help).toContain('Validate SRTD setup');
  });

  it('should run doctor and display all 10 checks', () => {
    const { output } = runDoctor();

    // Check branding appears
    expect(output).toContain('Doctor');

    // Check all 10 check names appear
    expect(output).toContain('Config file exists');
    expect(output).toContain('Config schema valid');
    expect(output).toContain('Template directory exists');
    expect(output).toContain('Migration directory exists');
    expect(output).toContain('Template directory readable');
    expect(output).toContain('Migration directory writable');
    expect(output).toContain('Build log valid');
    expect(output).toContain('Local build log valid');
    expect(output).toContain('Database connection');
    expect(output).toContain('Template count');
  });

  it('should exit with code 0 when all checks pass', () => {
    const { exitCode, output } = runDoctor();

    // In a properly configured project, all checks should pass
    expect(output).toContain('checks passed');
    expect(exitCode).toBe(0);
  });

  it('should display summary with pass/fail counts', () => {
    const { output } = runDoctor();

    // Should have a summary line
    expect(output).toMatch(/\d+ checks passed/);
  });
});
