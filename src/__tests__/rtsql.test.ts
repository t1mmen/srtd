import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExecaReturnValue } from 'execa';
import path from 'path';

const files = vi.hoisted(() => new Map<string, string>());
const fsImpl = vi.hoisted(() => ({
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
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('fs/promises', () => fsImpl);

import { execa } from 'execa';
import { loadLocalBuildLog } from '../utils/loadLocalBuildLog';
import { loadBuildLog } from '../utils/loadBuildLog';
import { isWipTemplate } from '../utils/isWipTemplate';
import { saveBuildLog } from '../utils/saveBuildLog';
import { saveLocalBuildLog } from '../utils/saveLocalBuildLog';
import { getNextTimestamp } from '../utils/getNextTimestamp';
import { buildTemplates } from '../rtsql/rtsql';
import { applyMigration } from '../utils/applyMigration';
import { calculateMD5 } from '../utils/md5';
import { BuildLog, LocalBuildLog, RTSQLConfig } from '../rtsql/rtsql.types';
import { loadConfig } from '../utils/config';

let config: RTSQLConfig;

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

  it('should detect WIP templates correctly', () => {
    expect(isWipTemplate('test.wip.sql')).toBe(true);
    expect(isWipTemplate('test.sql')).toBe(false);
  });

  it('should calculate consistent hashes', async () => {
    const content = 'SELECT * FROM test;';
    const hash1 = await calculateMD5(content);
    const hash2 = await calculateMD5(content);
    expect(hash1).toBe(hash2);
  });

  it('should clean up temporary files even if migration fails', async () => {
    vi.mocked(execa).mockRejectedValueOnce(new Error('DB Error'));
    const tempPath = path.resolve(__dirname, '../.temp-migration.sql');

    // Create a mock file first to simulate the file existing
    await fsImpl.default.writeFile(tempPath, 'test content');

    const result = await applyMigration(tempPath, 'test');
    expect(result).toEqual({
      file: path.basename(tempPath),
      error: 'DB Error',
      templateName: 'test',
    });
    expect(fsImpl.default.unlink).toHaveBeenCalledWith(tempPath);
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
    };

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
    templates: {
      'test.sql': {
        lastHash: '123',
        lastBuilt: '2024-01-01',
        lastMigration: 'migration.sql',
      },
    },
    lastTimestamp: '20240101120000',
  };

  const mockLocalBuildLog = {
    templates: {
      'test.sql': {
        lastApplied: '123',
      },
    },
  };

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
    const buildLog = await loadBuildLog(__dirname);
    const localBuildLog = await loadLocalBuildLog(__dirname);

    expect(buildLog).toEqual(mockBuildLog);
    expect(localBuildLog).toEqual(mockLocalBuildLog);
  });

  it('should handle missing build logs', async () => {
    files.clear();

    const buildLog = await loadBuildLog(__dirname);
    const localBuildLog = await loadLocalBuildLog(__dirname);

    expect(buildLog).toEqual({ templates: {}, lastTimestamp: '' });
    expect(localBuildLog).toEqual({ templates: {} });
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
    } satisfies LocalBuildLog;

    await saveBuildLog(__dirname, newBuildLog);
    await saveLocalBuildLog(__dirname, newLocalBuildLog);

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

describe('Migration Application', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply migrations successfully', async () => {
    vi.mocked(execa).mockResolvedValueOnce({
      stdout: Buffer.from('Success'),
      stderr: Buffer.from(''),
      exitCode: 0,
      failed: false,
      killed: false,
      signal: undefined, // Changed from null to undefined
      command: '',
      timedOut: false,
      isCanceled: false,
      all: Buffer.from(''),
      escapedCommand: '',
      cwd: process.cwd(),
    } as ExecaReturnValue<Buffer>);

    const result = await applyMigration('test.sql', 'test');
    expect(result).toBe(true);

    expect(execa).toHaveBeenCalledWith('psql', [
      config.pgConnection,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      'test.sql',
    ]);
  });

  it('should handle migration failures', async () => {
    vi.mocked(execa).mockRejectedValueOnce(new Error('DB Error'));
    const result = await applyMigration('test.sql', 'test');
    expect(result).toEqual({
      file: 'test.sql',
      error: 'DB Error',
      templateName: 'test',
    });
  });
});

describe('buildTemplates', () => {
  it('should process templates with default config', async () => {
    const result = await buildTemplates();
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('applied');
  });

  // it('should respect custom configuration', async () => {
  //   const result = await buildTemplates({
  //     filter: '*.sql',
  //     force: true,
  //     apply: true,
  //   });
  //   // Add assertions based on expected behavior
  // });
});
