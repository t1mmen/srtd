import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyBuildLog } from './createEmptyBuildLog.js';

// Mock the safeCreate function to prevent actual file creation
vi.mock('./safeCreate.js', () => ({
  safeCreate: vi.fn().mockResolvedValue(true),
}));

describe('createEmptyBuildLog', () => {
  const tempFilePath = path.join(os.tmpdir(), 'test-build-log.json');

  it('should create an empty build log object with correct structure', async () => {
    // Call with a file path
    const result = await createEmptyBuildLog(tempFilePath);

    // Function should return true (from safeCreate mock)
    expect(result).toBe(true);

    // Since we mocked safeCreate, let's verify the call structure
    const safeCreateModule = await import('./safeCreate.js');
    const safeCreate = safeCreateModule.safeCreate as unknown as ReturnType<typeof vi.fn>;

    expect(safeCreate).toHaveBeenCalledWith(
      tempFilePath,
      expect.stringContaining('"version": "1.0"')
    );

    // Verify the JSON structure through the argument passed to safeCreate
    const jsonArg = (safeCreate.mock.calls[0] as unknown as string[])[1];
    const parsed = JSON.parse(jsonArg as string);

    expect(parsed).toEqual({
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    });
  });

  it('should be immutable - generate a new object for each call', async () => {
    const filepath1 = path.join(os.tmpdir(), 'test-build-log-1.json');
    const filepath2 = path.join(os.tmpdir(), 'test-build-log-2.json');

    await createEmptyBuildLog(filepath1);
    await createEmptyBuildLog(filepath2);

    // Should have been called twice with different paths
    const safeCreateModule = await import('./safeCreate.js');
    const safeCreate = safeCreateModule.safeCreate as unknown as ReturnType<typeof vi.fn>;

    expect(safeCreate).toHaveBeenCalledTimes(3); // includes call from previous test

    // Get the content passed to safeCreate for both calls
    const callArgs = safeCreate.mock.calls;

    // Type assertions to help TypeScript
    expect((callArgs[1] as unknown as string[])[0]).toBe(filepath1);
    expect((callArgs[2] as unknown as string[])[0]).toBe(filepath2);

    // Content should be the same structure for both
    const content1 = JSON.parse((callArgs[1] as unknown as string[])[1] as string);
    const content2 = JSON.parse((callArgs[2] as unknown as string[])[1] as string);
    expect(content1).toEqual(content2);
  });
});
