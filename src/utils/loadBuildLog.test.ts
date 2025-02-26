import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBuildLog } from './loadBuildLog.js';

// Create a test directory
const TEST_ROOT = path.join(os.tmpdir(), `srtd-loadbuildlog-test-${Date.now()}`);

// Mock the config module
vi.mock('./config.js', () => ({
  getConfig: vi.fn().mockResolvedValue({
    buildLog: '.buildlog-test.json',
    localBuildLog: '.buildlog-test.local.json',
    // Other required properties
    templateDir: '',
    migrationDir: '',
    migrationPrefix: '',
    filter: '',
    wipIndicator: '',
    pgConnection: '',
    wrapInTransaction: true,
    banner: '',
    footer: '',
  }),
}));

describe('loadBuildLog', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure test directory exists
    await fs.mkdir(TEST_ROOT, { recursive: true });
  });

  afterAll(async () => {
    // Clean up
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });

  it('should load existing build log', async () => {
    const content = {
      version: '1.0',
      lastTimestamp: '20240101120000',
      templates: {
        'test.sql': {
          lastBuildHash: 'abc123',
          lastBuildDate: '2024-01-01T12:00:00Z',
        },
      },
    };

    const filePath = path.join(TEST_ROOT, '.buildlog-test.json');
    await fs.writeFile(filePath, JSON.stringify(content));

    const log = await loadBuildLog(TEST_ROOT, 'common');
    expect(log).toEqual(content);
  });

  it('should return empty build log when file does not exist', async () => {
    const log = await loadBuildLog(path.join(TEST_ROOT, 'nonexistent'), 'common');
    expect(log).toEqual({
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    });
  });

  it('should handle invalid JSON', async () => {
    const filePath = path.join(TEST_ROOT, '.buildlog-test.local.json');
    await fs.writeFile(filePath, 'invalid json');

    const log = await loadBuildLog(TEST_ROOT, 'local');
    expect(log).toEqual({
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    });
  });

  it('should handle missing fields', async () => {
    const incompleteContent = {
      version: '1.0',
    };

    const filePath = path.join(TEST_ROOT, '.buildlog-test.json');
    await fs.writeFile(filePath, JSON.stringify(incompleteContent));

    const log = await loadBuildLog(TEST_ROOT, 'common');
    expect(log).toEqual({
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    });
  });

  it('should load correct file based on type parameter', async () => {
    const commonContent = { version: '1.0', templates: { common: true }, lastTimestamp: '' };
    const localContent = { version: '1.0', templates: { local: true }, lastTimestamp: '' };

    const commonPath = path.join(TEST_ROOT, '.buildlog-test.json');
    const localPath = path.join(TEST_ROOT, '.buildlog-test.local.json');

    await fs.writeFile(commonPath, JSON.stringify(commonContent));
    await fs.writeFile(localPath, JSON.stringify(localContent));

    const commonLog = await loadBuildLog(TEST_ROOT, 'common');
    const localLog = await loadBuildLog(TEST_ROOT, 'local');

    expect(commonLog.templates).toEqual({ common: true });
    expect(localLog.templates).toEqual({ local: true });
  });
});
