import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

const files = vi.hoisted(() => new Map<string, string>());
const fsImpl = vi.hoisted(() => {
  return {
    default: {
      writeFile: vi.fn((path: string, content: string) => {
        files.set(path, content);
        return Promise.resolve();
      }),
      readFile: vi.fn((path: string) => {
        const content = files.get(path);
        return content ? Promise.resolve(content) : Promise.reject(new Error('File not found'));
      }),
      unlink: vi.fn(() => Promise.resolve()),
    },
  };
});

vi.mock('fs/promises', () => fsImpl);

import { loadBuildLog } from '../src/utils/loadBuildLog';
import { isWipTemplate } from '../src/utils/isWipTemplate';
import { saveBuildLog } from '../src/utils/saveBuildLog';
import { getNextTimestamp } from '../src/utils/getNextTimestamp';
import { calculateMD5 } from '../src/utils/calculateMD5';
import { BuildLog, CLIConfig } from '../src/types';
import { loadConfig } from '../src/utils/config';

let config: CLIConfig;

const setup = async () => {
  config = await loadConfig();
};
setup();

describe('Template Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Skip console logs in testing
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should detect WIP templates correctly', async () => {
    expect(await isWipTemplate('test.wip.sql')).toBe(true);
    expect(await isWipTemplate('test.sql')).toBe(false);
  });

  it('should calculate consistent hashes', async () => {
    const content = 'SELECT * FROM test;';
    const hash1 = await calculateMD5(content);
    const hash2 = await calculateMD5(content);
    expect(hash1).toBe(hash2);
  });

  it('should not overwrite existing migration files', async () => {
    const { migrationDir } = await loadConfig();
    // Setup existing migration file
    const existingTimestamp = '20241125223247';
    const existingPath = path.join(migrationDir, `${existingTimestamp}_tmpl-test.sql`);
    const existingContent = 'existing content';
    files.set(existingPath, existingContent);

    // Setup build log with the same timestamp
    const buildLog = {
      templates: {},
      lastTimestamp: existingTimestamp,
      version: '1.0',
    } satisfies BuildLog;

    // Get next timestamp - should be different
    const newTimestamp = await getNextTimestamp(buildLog);

    // Assertions
    expect(newTimestamp).not.toBe(existingTimestamp);
    expect(BigInt(newTimestamp)).toBeGreaterThan(BigInt(existingTimestamp));
    expect(files.get(existingPath)).toBe(existingContent); // Original file unchanged
  });
});

describe('Build Logs', () => {
  const mockBuildLog = {
    version: '1.0',
    lastTimestamp: '20240101120000',
    templates: {
      'test.sql': {
        lastBuildHash: '123',
        lastBuildDate: '2024-01-01',
        lastMigrationFile: 'migration.sql',
      },
    },
  } satisfies BuildLog;

  const mockLocalBuildLog = {
    version: '1.0',
    lastTimestamp: '',
    templates: {
      'test.sql': {
        lastAppliedHash: '123',
        lastAppliedDate: '2024-12-25T07:07:37+00:00',
        lastMigrationFile: '',
      },
    },
  } satisfies BuildLog;

  beforeEach(() => {
    vi.clearAllMocks();
    files.clear();

    // Pre-populate mock filesystem with absolute paths
    files.set(path.resolve(__dirname, config.buildLog), JSON.stringify(mockBuildLog));
    files.set(path.resolve(__dirname, config.localBuildLog), JSON.stringify(mockLocalBuildLog));
  });

  afterEach(() => {
    files.clear();
  });

  it('should load build logs correctly', async () => {
    const buildLog = await loadBuildLog(__dirname, 'common');
    const localBuildLog = await loadBuildLog(__dirname, 'local');

    expect(buildLog).toEqual(mockBuildLog);
    expect(localBuildLog).toEqual(mockLocalBuildLog);
  });

  it('should handle missing build logs', async () => {
    files.clear();

    const buildLog = await loadBuildLog(__dirname, 'common');
    const localBuildLog = await loadBuildLog(__dirname, 'local');

    expect(buildLog).toEqual({ templates: {}, lastTimestamp: '', version: '1.0' });
    expect(localBuildLog).toEqual({ templates: {}, lastTimestamp: '', version: '1.0' });
  });

  it('should save build logs correctly', async () => {
    const newBuildLog = {
      templates: {
        'new.sql': {
          lastBuildHash: '456',
          lastBuildDate: '2024-01-02',
          lastMigrationFile: 'new-migration.sql',
        },
      },
      lastTimestamp: '20240102120000',
      version: '1.0',
    } satisfies BuildLog;

    const newLocalBuildLog = {
      templates: {
        'new.sql': {
          lastAppliedHash: '456',
          lastAppliedDate: '2024-01-02',
        },
      },
      lastTimestamp: '',
      version: '1.0',
    } satisfies BuildLog;

    await saveBuildLog(__dirname, newBuildLog, 'common');
    await saveBuildLog(__dirname, newLocalBuildLog, 'local');

    const savedBuildLog = JSON.parse(files.get(path.resolve(__dirname, config.buildLog)) || '');
    const savedLocalBuildLog = JSON.parse(
      files.get(path.resolve(__dirname, config.localBuildLog)) || ''
    );

    expect(savedBuildLog).toEqual(newBuildLog);
    expect(savedLocalBuildLog).toEqual(newLocalBuildLog);
  });

  it('should generate sequential timestamps', async () => {
    const buildLog = { templates: {}, lastTimestamp: '20240101120000', version: '1.0' };
    const timestamp1 = await getNextTimestamp(buildLog);
    const timestamp2 = await getNextTimestamp(buildLog);
    expect(BigInt(timestamp2)).toBeGreaterThan(BigInt(timestamp1));
  });

  it('should handle timestamp collisions', async () => {
    const buildLog = { templates: {}, lastTimestamp: '20240101120000', version: '1.0' };
    vi.setSystemTime(new Date('2024-01-01T11:59:59Z')); // Earlier than lastTimestamp

    const timestamp = await getNextTimestamp(buildLog);
    expect(timestamp).toBe('20240101120001'); // Should increment the last timestamp
    expect(buildLog.lastTimestamp).toBe('20240101120001');
  });

  it('should use current time when newer than last timestamp', async () => {
    const buildLog = { templates: {}, lastTimestamp: '20240101120000', version: '1.0' };
    vi.setSystemTime(new Date('2024-01-01T13:00:00Z')); // Later than lastTimestamp

    const timestamp = await getNextTimestamp(buildLog);
    expect(timestamp).toBe('20240101130000');
    expect(buildLog.lastTimestamp).toBe('20240101130000');
  });
});
