// src/__tests__/helpers.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { TEST_FN_PREFIX } from './vitest.setup.js';

interface TestContext {
  timestamp: number;
  testDir: string;
  testFunctionName: string;
  templateCounter: number;
}

/**
 * Creates a test context with all the goodies we need! 🎁
 */
export function createTestContext(name = 'test'): TestContext {
  return {
    timestamp: Date.now(),
    testDir: path.join(process.env.TMPDIR || '/tmp', `srtd-${name}-${Date.now()}`),
    testFunctionName: `${TEST_FN_PREFIX}${Date.now()}`,
    templateCounter: 0,
  };
}

/**
 * Get unique template names - perfect for testing! 🏷️
 */
export function getNextTemplateName(context: TestContext, prefix = 'template') {
  context.templateCounter++;
  return `${prefix}_${context.timestamp}_${context.templateCounter}`;
}

/**
 * Create a template file with whatever content you want! 📝
 */
export async function createTemplate(
  context: TestContext,
  name: string,
  content: string,
  dir?: string
) {
  const fullPath = dir
    ? path.join(context.testDir, 'test-templates', dir, name)
    : path.join(context.testDir, 'test-templates', name);

  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
}

/**
 * Create a template with a basic Postgres function - the bread and butter of testing! 🍞
 */
export async function createTemplateWithFunc(
  context: TestContext,
  prefix: string,
  funcSuffix = '',
  dir?: string
) {
  const name = `${getNextTemplateName(context, prefix)}.sql`;
  const funcName = `${context.testFunctionName}${funcSuffix}`;
  const content = `CREATE OR REPLACE FUNCTION ${funcName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
  return createTemplate(context, name, content, dir);
}

/**
 * Clean up after our tests like good citizens! 🧹
 */
export async function cleanupTestContext(context: TestContext) {
  await fs.rm(context.testDir, { recursive: true, force: true });
}
