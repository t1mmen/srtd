/**
 * End-to-end interactive tests for the srtd CLI
 *
 * Verifies available commands and their help output.
 *
 * IMPORTANT: These tests must FAIL when CLI execution fails.
 * No silent skipping - CI must catch broken CLI builds.
 */

import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Extract CLI output from npm run output.
 * CLI output starts at the "Usage:" line.
 * @throws Error if "Usage:" section not found
 */
function extractCliOutput(output: string, command?: string): string {
  const lines = output.split('\n');
  const cliStartIndex = lines.findIndex(line => line.includes('Usage:'));
  if (cliStartIndex < 0) {
    throw new Error(
      `CLI output for '${command || 'main'}' did not contain expected "Usage:" section. Got: ${output.slice(0, 200)}`
    );
  }
  return lines.slice(cliStartIndex).join('\n');
}

describe('CLI Help Test', () => {
  /**
   * Run CLI with --help flag for a command.
   * @throws Error if CLI execution fails completely
   */
  function getCommandHelp(command?: string): string {
    const cmd = command ? `npm run start -- ${command} --help` : `npm run start -- --help`;
    let output: string;

    try {
      output = execSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // Override SRTD_TEST_MODE to get real CLI output
        env: { ...process.env, SRTD_TEST_MODE: undefined },
      });
    } catch (error) {
      // Commander exits with code 0 for --help but execSync may still throw
      // if there's output on stderr. Extract stdout if available.
      if (error && typeof error === 'object' && 'stdout' in error && error.stdout) {
        output = String(error.stdout);
      } else {
        // CLI execution failed completely - this is a test failure
        throw new Error(
          `CLI help command failed for '${command || 'main'}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return extractCliOutput(output, command);
  }

  it('should show main help menu with all commands', () => {
    const help = getCommandHelp();

    // Check for key components
    expect(help).toContain('Usage:');
    expect(help).toContain('Options:');
    expect(help).toContain('Commands:');

    // Check that main commands are listed
    expect(help).toContain('apply');
    expect(help).toContain('build');
    expect(help).toContain('init');
    expect(help).toContain('watch');
    expect(help).toContain('clear');
  });

  it('should show help for build command', () => {
    const help = getCommandHelp('build');

    expect(help).toContain('Usage:');
    expect(help).toContain('build');
    expect(help).toContain('Options:');
  });

  it('should show help for apply command', () => {
    const help = getCommandHelp('apply');

    expect(help).toContain('Usage:');
    expect(help).toContain('apply');
    expect(help).toContain('Options:');
  });

  it('should show help for watch command', () => {
    const help = getCommandHelp('watch');

    expect(help).toContain('Usage:');
    expect(help).toContain('watch');
    expect(help).toContain('Options:');
  });
});
