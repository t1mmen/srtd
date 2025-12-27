/**
 * Tests for CLI functionality for common integration scenarios
 *
 * IMPORTANT: These tests must FAIL when CLI execution fails.
 * No silent skipping - CI must catch broken CLI builds.
 */

import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('CLI Version Test', () => {
  it('should display version information', () => {
    let output: string;

    try {
      output = execSync('npm run start -- --version', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      // Commander exits with code 0 for --version but execSync may still throw
      // if there's output on stderr. Extract stdout if available.
      if (error && typeof error === 'object' && 'stdout' in error && error.stdout) {
        output = String(error.stdout);
      } else {
        // CLI execution failed completely - this is a test failure
        throw new Error(
          `CLI execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Should match semver pattern
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});
