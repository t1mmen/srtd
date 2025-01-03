import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { render } from 'ink-testing-library';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Apply from '../commands/apply.js';
import { connect } from '../utils/databaseConnection.js';
import { TEST_FN_PREFIX } from './vitest.setup.js';

vi.mock('../hooks/useTemplateProcessor', () => ({
  useTemplateProcessor: vi.fn().mockImplementation(() => ({
    isProcessing: false,
    result: {
      built: [],
      applied: ['test.sql'],
      skipped: [],
      errors: [],
    },
  })),
}));

describe('Apply Command', () => {
  const testContext = {
    timestamp: Date.now(),
    testFunctionName: `${TEST_FN_PREFIX}${Date.now()}`,
    testDir: path.join(tmpdir(), `test-apply-command-${Date.now()}`),
  };

  vi.mock('ink', async importOriginal => {
    const actual = (await importOriginal()) as typeof import('ink');
    const mockExit = vi.fn();
    return {
      ...actual,
      useApp: () => ({ exit: mockExit }),
    };
  });

  async function createTestTemplate(content: string) {
    const templateDir = path.join(testContext.testDir, 'test-templates');
    await fs.mkdir(templateDir, { recursive: true });
    const templatePath = path.join(templateDir, `test-${testContext.timestamp}.sql`);
    await fs.writeFile(templatePath, content);
  }

  beforeEach(async () => {
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

  test('shows progress and success', async () => {
    const { lastFrame } = render(<Apply options={{ force: false }} />);
    expect(lastFrame()).toMatch(/▶ test\.sql/);
  });

  test('handles force flag', async () => {
    const { lastFrame } = render(<Apply options={{ force: true }} />);
    expect(lastFrame()).toMatch(/▶ test\.sql/);
  });
});
