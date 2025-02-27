import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findProjectRoot } from './findProjectRoot.js';

describe('findProjectRoot', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `srtd-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    originalCwd = process.cwd();
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    try {
      // Use a more robust cleanup approach
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Cleanup error: ${err}`);
      // Continue even if cleanup fails
    }
  });

  it('should find project root with srtd.config.json', async () => {
    // Create a nested directory structure
    const projectRoot = path.join(tempDir, 'project');
    const nestedDir = path.join(projectRoot, 'src', 'components');

    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'srtd.config.json'), '{}');

    // Use explicit directory path instead of changing process.cwd
    const result = await findProjectRoot(nestedDir);
    expect(result).toBe(projectRoot);
  });

  it('should find project root with package.json', async () => {
    const projectRoot = path.join(tempDir, 'project');
    const nestedDir = path.join(projectRoot, 'src');

    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'package.json'), '{}');

    // Use explicit directory path
    const result = await findProjectRoot(nestedDir);
    expect(result).toBe(projectRoot);
  });

  it('should find project root with supabase directory', async () => {
    const projectRoot = path.join(tempDir, 'project');
    const nestedDir = path.join(projectRoot, 'src');
    const supabaseDir = path.join(projectRoot, 'supabase');

    await fs.mkdir(nestedDir, { recursive: true });
    await fs.mkdir(supabaseDir, { recursive: true });

    // Use explicit directory path
    const result = await findProjectRoot(nestedDir);
    expect(result).toBe(projectRoot);
  });

  it('should throw error if project root not found', async () => {
    // No project files in tempDir
    await expect(findProjectRoot()).rejects.toThrow('Could not find project root');
  });

  it('should accept custom starting directory', async () => {
    const projectRoot = path.join(tempDir, 'project');
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'package.json'), '{}');

    const result = await findProjectRoot(projectRoot);
    expect(result).toBe(projectRoot);
  });
});
