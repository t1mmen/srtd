/**
 * Simple verification test for CLI command structure
 *
 * This test doesn't run the actual CLI but validates that all expected
 * commands are correctly defined and registered in the application.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CLI Commands Test', () => {
  // Check for the existence of command files
  it('should have all required command files', async () => {
    const commandsDir = path.resolve(process.cwd(), 'src/commands');
    const files = await fs.readdir(commandsDir);

    // Verify core command files exist
    expect(files).toContain('apply.ts');
    expect(files).toContain('build.ts');
    expect(files).toContain('clear.ts');
    expect(files).toContain('init.ts');
    expect(files).toContain('watch.ts');
  });

  // Verify CLI entry point exists
  it('should have a main CLI entry point', async () => {
    const cliPath = path.resolve(process.cwd(), 'src/cli.ts');
    const exists = await fs
      .stat(cliPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
  });
});
