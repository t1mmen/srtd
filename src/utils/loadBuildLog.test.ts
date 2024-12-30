import { describe, it, expect } from 'vitest';
import { loadBuildLog } from './loadBuildLog.js';
import { TEST_ROOT } from '../__tests__/vitest.setup.js';
import fs from 'fs/promises';
import path from 'path';

describe('loadBuildLog', () => {
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

    await fs.writeFile(path.join(TEST_ROOT, '.buildlog-test.json'), JSON.stringify(content));

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
    await fs.writeFile(path.join(TEST_ROOT, '.buildlog-test.local.json'), 'invalid json');

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

    await fs.writeFile(
      path.join(TEST_ROOT, '.buildlog-test.json'),
      JSON.stringify(incompleteContent)
    );

    const log = await loadBuildLog(TEST_ROOT, 'common');
    expect(log).toEqual({
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    });
  });

  it('should load correct file based on type parameter', async () => {
    const commonContent = { version: '1.0', templates: { common: true } };
    const localContent = { version: '1.0', templates: { local: true } };

    await fs.writeFile(path.join(TEST_ROOT, '.buildlog-test.json'), JSON.stringify(commonContent));
    await fs.writeFile(
      path.join(TEST_ROOT, '.buildlog-test.local.json'),
      JSON.stringify(localContent)
    );

    const commonLog = await loadBuildLog(TEST_ROOT, 'common');
    const localLog = await loadBuildLog(TEST_ROOT, 'local');

    expect(commonLog.templates).toEqual({ common: true });
    expect(localLog.templates).toEqual({ local: true });
  });
});
