import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { render } from 'ink-testing-library';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Build from '../commands/build.js';
import { TEST_FN_PREFIX } from './vitest.setup.js';

vi.mock('../hooks/useTemplateProcessor', () => ({
  useTemplateProcessor: vi.fn().mockImplementation(({ apply }) => ({
    isProcessing: false,
    result: {
      built: ['test.sql'],
      applied: apply ? ['test.sql'] : [],
      skipped: [],
      errors: [],
    },
  })),
}));

describe('Build Command', () => {
  const testContext = {
    timestamp: Date.now(),
    testFunctionName: `${TEST_FN_PREFIX}${Date.now()}`,
    testDir: path.join(tmpdir(), 'srtd-test', `test-build-command-${Date.now()}`),
  };

  vi.mock('ink', async importOriginal => {
    const actual = (await importOriginal()) as typeof import('ink');
    return {
      ...actual,
      useApp: () => ({ exit: vi.fn() }),
    };
  });

  async function createTestTemplate(content: string) {
    const templateDir = path.join(testContext.testDir, 'test-templates');
    await fs.mkdir(templateDir, { recursive: true });
    const templatePath = path.join(templateDir, `test-${testContext.timestamp}.sql`);
    await fs.writeFile(templatePath, content);
    return templatePath;
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
    await fs.rm(testContext.testDir, { recursive: true, force: true });
  });

  test('shows build progress and success', async () => {
    const { lastFrame } = render(<Build options={{ force: false }} />);
    expect(lastFrame()).toMatch(/Built:\s*\n\s*✔ test\.sql/);
  });

  test('handles force flag', async () => {
    const { lastFrame } = render(<Build options={{ force: true }} />);
    expect(lastFrame()).toMatch(/Built:\s*\n\s*✔ test\.sql/);
  });

  test('handles build and apply together', async () => {
    const { lastFrame } = render(<Build options={{ force: false, apply: true }} />);
    // Use more precise matching that accounts for newlines
    expect(lastFrame()).toMatch(/Built:\s*\n\s*✔ test\.sql/);
    expect(lastFrame()).toMatch(/Applied:\s*\n\s*▶ test\.sql/);
  });
});
