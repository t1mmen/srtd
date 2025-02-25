import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEST_ROOT } from '../__tests__/vitest.setup.js';
import { loadBuildLog } from './loadBuildLog.js';

describe('loadBuildLog', () => {
  it('should load existing build log', async () => {
    // Ensure TEST_ROOT directory exists before writing to it
    await fs.mkdir(TEST_ROOT, { recursive: true });

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

    await fs.writeFile(path.join(TEST_ROOT, '.buildlog-test.json'), `${JSON.stringify(content)}\n`);

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
    // Ensure TEST_ROOT directory exists before writing to it
    await fs.mkdir(TEST_ROOT, { recursive: true });

    await fs.writeFile(path.join(TEST_ROOT, '.buildlog-test.local.json'), 'invalid json\n');

    const log = await loadBuildLog(TEST_ROOT, 'local');
    expect(log).toEqual({
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    });
  });

  it('should handle missing fields', async () => {
    // Ensure TEST_ROOT directory exists before writing to it
    await fs.mkdir(TEST_ROOT, { recursive: true });

    const incompleteContent = {
      version: '1.0',
    };

    await fs.writeFile(
      path.join(TEST_ROOT, '.buildlog-test.json'),
      `${JSON.stringify(incompleteContent)}\n`
    );

    const log = await loadBuildLog(TEST_ROOT, 'common');
    expect(log).toEqual({
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    });
  });

  it('should load correct file based on type parameter', async () => {
    // Ensure TEST_ROOT directory exists before writing to it
    await fs.mkdir(TEST_ROOT, { recursive: true });

    const commonContent = { version: '1.0', templates: { common: true } };
    const localContent = { version: '1.0', templates: { local: true } };

    await fs.writeFile(
      path.join(TEST_ROOT, '.buildlog-test.json'),
      `${JSON.stringify(commonContent)}\n`
    );
    await fs.writeFile(
      path.join(TEST_ROOT, '.buildlog-test.local.json'),
      `${JSON.stringify(localContent)}\n`
    );

    const commonLog = await loadBuildLog(TEST_ROOT, 'common');
    const localLog = await loadBuildLog(TEST_ROOT, 'local');

    expect(commonLog.templates).toEqual({ common: true });
    expect(localLog.templates).toEqual({ local: true });
  });
});
