import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Build from '../commands/build.js';
import { connect } from '../utils/databaseConnection.js';
import { TEST_FN_PREFIX } from './vitest.setup.js';

// Mock terminal-kit to capture output
let terminalOutput: string[] = [];
const mockTerminal = {
  clear: vi.fn(),
  processExit: vi.fn(),
  yellow: vi.fn((text: string) => {
    terminalOutput.push(`YELLOW: ${text}`);
  }),
  green: vi.fn((text: string) => {
    terminalOutput.push(`GREEN: ${text}`);
  }),
  red: vi.fn((text: string) => {
    terminalOutput.push(`RED: ${text}`);
  }),
  cyan: vi.fn((text: string) => {
    terminalOutput.push(`CYAN: ${text}`);
  }),
  dim: vi.fn((text: string) => {
    terminalOutput.push(`DIM: ${text}`);
  }),
  bold: vi.fn((text: string) => {
    terminalOutput.push(`BOLD: ${text}`);
  }),
  eraseDisplayBelow: vi.fn(),
  up: vi.fn(),
  '(': vi.fn((text: string) => {
    terminalOutput.push(text);
  }),
};

// Make the mock callable
Object.setPrototypeOf(mockTerminal, Function.prototype);
(mockTerminal as any)['('] = (text: string) => {
  terminalOutput.push(text);
};

vi.mock('terminal-kit', () => ({
  terminal: mockTerminal,
}));

// Mock the Branding component
vi.mock('../components/Branding.js', () => ({
  Branding: class {
    constructor() {}
    mount() {}
  },
}));

// Mock the ProcessingResults component
vi.mock('../components/ProcessingResults.js', () => ({
  ProcessingResults: class {
    constructor() {}
    mount() {}
  },
}));

describe('Build Command', () => {
  const testContext = {
    timestamp: Date.now(),
    testFunctionName: `${TEST_FN_PREFIX}${Date.now()}`,
    testDir: path.join(tmpdir(), 'srtd-test', `test-build-command-${Date.now()}`),
  };

  async function createTestTemplate(content: string) {
    const templateDir = path.join(testContext.testDir, 'test-templates');
    await fs.mkdir(templateDir, { recursive: true });
    const templatePath = path.join(templateDir, `test-${testContext.timestamp}.sql`);
    await fs.writeFile(templatePath, content);
    return templatePath;
  }

  beforeEach(async () => {
    // Clear terminal output
    terminalOutput = [];

    // Reset all mocks
    vi.clearAllMocks();

    const validSQL = `
      CREATE OR REPLACE FUNCTION ${testContext.testFunctionName}()
      RETURNS void AS $$
      BEGIN NULL; END;
      $$ LANGUAGE plpgsql;
    `;
    await createTestTemplate(validSQL);
  });

  afterEach(async () => {
    const client = await connect();
    try {
      await client.query(`DROP FUNCTION IF EXISTS ${testContext.testFunctionName}()`);
    } finally {
      client.release();
    }
    await fs.rm(testContext.testDir, { recursive: true, force: true });
  });

  test('executes without errors', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await Build({ options: { force: false } });
    } catch (error) {
      // Expected to throw due to mocked process.exit
      expect(String(error)).toContain('process.exit called');
    }

    // Verify that the terminal was used
    expect(mockTerminal.yellow).toHaveBeenCalled();

    mockExit.mockRestore();
  });

  test('handles force flag', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await Build({ options: { force: true } });
    } catch (error) {
      // Expected to throw due to mocked process.exit
      expect(String(error)).toContain('process.exit called');
    }

    // Verify that the terminal was used
    expect(mockTerminal.yellow).toHaveBeenCalled();

    mockExit.mockRestore();
  });

  test('handles apply flag', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await Build({ options: { force: false, apply: true } });
    } catch (error) {
      // Expected to throw due to mocked process.exit
      expect(String(error)).toContain('process.exit called');
    }

    // Verify that the terminal was used for both build and apply
    expect(mockTerminal.yellow).toHaveBeenCalled();

    mockExit.mockRestore();
  });

  test('handles bundle flag', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await Build({ options: { force: false, bundle: true } });
    } catch (error) {
      // Expected to throw due to mocked process.exit
      expect(String(error)).toContain('process.exit called');
    }

    // Verify that the terminal was used
    expect(mockTerminal.yellow).toHaveBeenCalled();

    mockExit.mockRestore();
  });

  test('shows loading messages', async () => {
    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await Build({ options: { force: false } });
    } catch (error) {
      // Expected to throw due to mocked process.exit
    }

    // Check that loading message was shown
    const hasLoadingMessage = terminalOutput.some(
      output => output.includes('Building templates') || output.includes('⏳')
    );
    expect(hasLoadingMessage).toBe(true);

    mockExit.mockRestore();
  });
});
