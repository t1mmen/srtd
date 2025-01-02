import fs from 'node:fs/promises';
import path from 'node:path';
//src/__tests__/apply.test.tsx
import { render } from 'ink-testing-library';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Apply from '../commands/apply.js';
import { connect } from '../utils/databaseConnection.js';
import { TEST_FN_PREFIX } from './vitest.setup.js';

describe('Apply Command', () => {
  const testContext = {
    timestamp: Date.now(),
    testFunctionName: `${TEST_FN_PREFIX}${Date.now()}`,
    testDir: path.join(process.cwd(), `test-apply-command-${Date.now()}`),
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
    const { frames } = render(<Apply options={{ force: false }} />);

    // Should initially show applying message
    expect(frames[0]).toContain('Applying');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should eventually show applied message
    const lastFrames = frames.slice(-5);
    expect(lastFrames.some(frame => frame.includes('Applied'))).toBe(true);
  });

  test('handles force flag', async () => {
    // Apply once normally
    render(<Apply options={{ force: false }} />);
    await new Promise(resolve => setTimeout(resolve, 200));

    // Apply again with force
    const forceRender = render(<Apply options={{ force: true }} />);
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(forceRender.frames.slice(-5).some(frame => frame.includes('Applied'))).toBe(true);
  });
});
