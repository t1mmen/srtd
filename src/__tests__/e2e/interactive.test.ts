/**
 * End-to-end interactive tests for the srtd CLI
 *
 * Verifies available commands and their help output.
 */

import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('CLI Help Test', () => {
  // Helper function to run CLI with --help flag for a command
  function getCommandHelp(command?: string): string {
    try {
      const cmd = command ? `npm run start -- ${command} --help` : `npm run start -- --help`;

      const output = execSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Extract the actual CLI output by removing npm script output
      // The CLI output starts after the second line (after "npm run" output)
      const lines = output.split('\n');
      const cliStartIndex = lines.findIndex(line => line.includes('Usage:'));
      return cliStartIndex >= 0 ? lines.slice(cliStartIndex).join('\n') : output;
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error) {
        const output = String(error.stdout || '');
        const lines = output.split('\n');
        const cliStartIndex = lines.findIndex(line => line.includes('Usage:'));
        return cliStartIndex >= 0 ? lines.slice(cliStartIndex).join('\n') : output;
      }
      return '';
    }
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
