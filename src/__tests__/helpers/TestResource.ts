/**
 * TestResource.ts - A utility for consistent, isolated, and reliable test resource management
 *
 * This class provides a standardized way to manage test resources (filesystem and database) across
 * all tests in the project. It helps prevent test flakiness by ensuring each test has its own:
 *
 * 1. Isolated directory for files and templates
 * 2. Unique database function names
 * 3. Proper resource cleanup at the end of each test
 * 4. Consistent helper methods for common operations
 *
 * Usage example:
 * ```typescript
 * it('should test something', async () => {
 *   // Create an isolated test environment with unique prefix
 *   using resources = new TestResource({ prefix: 'my-test' });
 *   await resources.setup();
 *
 *   // Create test template
 *   const templatePath = await resources.createTemplateWithFunc('test', '_suffix');
 *
 *   // Perform safe database operations
 *   await resources.withTransaction(async (client) => {
 *     const res = await client.query('SELECT ...');
 *     return res.rows;
 *   });
 *
 *   // Resources automatically cleaned up at the end of the test via the dispose pattern
 * });
 * ```
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { ensureDirectories } from '../../utils/ensureDirectories.js';
import { getTestDatabaseService, TEST_FN_PREFIX, TEST_ROOT_BASE } from '../vitest.setup.js';

/**
 * Helper class to manage test resources consistently across all tests.
 * Handles both filesystem and database resources with proper cleanup.
 */
export class TestResource {
  /** Unique ID for this test resource instance */
  public readonly testId: string;

  /** Directory for this test's files */
  public readonly testDir: string;

  /** Base function name for database objects created by this test */
  public readonly testFunctionName: string;

  /** Counter for generating unique resource names */
  private resourceCounter = 0;

  /** Tracks database clients that need to be released during cleanup */
  private dbClients: PoolClient[] = [];

  /** Tracks whether setup has been performed */
  private isSetup = false;

  /** Tracks whether cleanup has been performed */
  private isCleanedUp = false;

  /**
   * Creates a new test resource manager
   * @param options Configuration options
   */
  constructor(options?: { prefix?: string }) {
    // Generate a unique ID using a combination of timestamp and random value
    const uniqueId = randomUUID().replace(/-/g, '').substring(0, 8);
    this.testId = uniqueId;

    const prefix = options?.prefix || 'test';
    this.testDir = path.join(TEST_ROOT_BASE, `srtd-${prefix}-${this.testId}`);
    this.testFunctionName = `${TEST_FN_PREFIX}${this.testId}`;
  }

  /**
   * Setup test resources (filesystem and database)
   */
  async setup(): Promise<void> {
    if (this.isSetup) return;

    // Create test directory
    await ensureDirectories(this.testDir);

    // Setup database (create transaction to ensure atomicity)
    const dbService = await getTestDatabaseService();
    const client = await dbService.connect();
    this.dbClients.push(client);

    try {
      await client.query('BEGIN');
      // Database initialization can be done here if needed
      // or in specific tests using the transaction API
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
      this.dbClients = this.dbClients.filter(c => c !== client);
    }

    this.isSetup = true;
  }

  /**
   * Cleanup all resources created by this test
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true; // Mark as cleaned up immediately to prevent multiple cleanup attempts

    // Release any unreleased database clients
    for (const client of this.dbClients) {
      try {
        client.release();
      } catch (_e) {
        // Ignore errors when releasing clients
      }
    }
    this.dbClients = [];

    // Clean up database objects with retry logic
    let dbCleanupSuccess = false;
    const dbService = await getTestDatabaseService();

    for (let attempt = 1; attempt <= 3; attempt++) {
      let client: PoolClient | undefined;
      try {
        client = await dbService.connect({ silent: true });
        await client.query('BEGIN');

        // Drop any functions created by this test
        await client.query(`
          DO $$
          DECLARE
            r record;
          BEGIN
            FOR r IN
              SELECT quote_ident(proname) AS func_name
              FROM pg_proc
              WHERE proname LIKE '${this.testFunctionName}%'
            LOOP
              EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name;
            END LOOP;
          END;
          $$;
        `);

        await client.query('COMMIT');
        dbCleanupSuccess = true;
        client.release();
        break; // Success, exit retry loop
      } catch (e) {
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch {
            // Ignore errors during rollback - empty catch on purpose
          }
          client.release();
        }

        if (attempt === 3) {
          console.error('Error cleaning up database resources after 3 attempts:', e);
        } else {
          // Wait briefly before retrying
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }

    if (!dbCleanupSuccess) {
      console.warn(`Failed to clean up database functions for test ${this.testId}`);
    }

    // Clean up filesystem with retry logic
    try {
      // Make 3 attempts to clean up the directory with delay between attempts
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await fs.rm(this.testDir, { recursive: true, force: true });
          break; // Success, exit loop
        } catch (e) {
          if (attempt === 3) {
            // On last attempt, log the error
            console.error('Error cleaning up filesystem resources after 3 attempts:', e);
            throw e;
          }
          // Wait briefly before retrying
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (e) {
      console.error('Failed to clean up test directory:', e);
    }

    this.isCleanedUp = true;
  }

  /**
   * Get a unique resource name with an optional prefix
   */
  getNextResourceName(prefix = 'resource'): string {
    this.resourceCounter++;
    return `${prefix}_${this.testId}_${this.resourceCounter}`;
  }

  /**
   * Create a template file with the given content
   * @returns Full path to the created template
   */
  async createTemplate(name: string, content: string, dir?: string): Promise<string> {
    const fullPath = dir
      ? path.join(this.testDir, 'test-templates', dir, name)
      : path.join(this.testDir, 'test-templates', name);

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
   * Create a template with a SQL function definition
   * @returns Full path to the created template
   */
  async createTemplateWithFunc(prefix: string, funcSuffix = '', dir?: string): Promise<string> {
    const name = `${this.getNextResourceName(prefix)}.sql`;
    const funcName = `${this.testFunctionName}${funcSuffix}`;
    const content = `CREATE OR REPLACE FUNCTION ${funcName}() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`;
    return this.createTemplate(name, content, dir);
  }

  /**
   * Create a SQL file with complex SQL function definition
   * @returns Full path to the created template
   */
  async createComplexSQLTemplate(prefix: string, funcSuffix = '', dir?: string): Promise<string> {
    const name = `${this.getNextResourceName(prefix)}.sql`;
    const funcName = `${this.testFunctionName}${funcSuffix}`;

    const content = `
      CREATE OR REPLACE FUNCTION ${funcName}(
        param1 integer DEFAULT 100,
        OUT result1 integer,
        OUT result2 text
      ) RETURNS record AS $$
      DECLARE
        temp_var integer;
      BEGIN
        -- Complex logic with multiple statements
        SELECT CASE
          WHEN param1 > 100 THEN param1 * 2
          ELSE param1 / 2
        END INTO temp_var;

        result1 := temp_var;
        result2 := 'Processed: ' || temp_var::text;

        -- Exception handling
        EXCEPTION WHEN OTHERS THEN
          result1 := -1;
          result2 := SQLERRM;
      END;
      $$ LANGUAGE plpgsql;
    `;

    return this.createTemplate(name, content, dir);
  }

  /**
   * Acquire a database client that will be automatically released on cleanup
   */
  async getClient(): Promise<PoolClient> {
    const dbService = await getTestDatabaseService();
    const client = await dbService.connect();
    this.dbClients.push(client);
    return client;
  }

  /**
   * Run a database query with transaction support
   * @param queryFn Function that will receive the client and execute queries
   * @returns Result of the callback function
   */
  async withTransaction<T>(queryFn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await queryFn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
      this.dbClients = this.dbClients.filter(c => c !== client);
    }
  }

  /**
   * Pause execution for the specified time
   * @param ms Time to wait in milliseconds
   */
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verify that a function exists in the database
   * @param funcSuffix Suffix for the function name
   */
  async verifyFunctionExists(funcSuffix = '', retries = 3, delay = 20): Promise<boolean> {
    const funcName = `${this.testFunctionName}${funcSuffix}`;

    try {
      return await this.withTransaction(async client => {
        try {
          const res = await client.query(`SELECT COUNT(*) FROM pg_proc WHERE proname = $1`, [
            funcName,
          ]);
          return Number.parseInt(res.rows[0].count, 10) > 0;
        } catch (error) {
          if (retries <= 0) throw error;
          await this.wait(delay);
          return await this.verifyFunctionExists(funcSuffix, retries - 1, delay * 2);
        }
      });
    } catch (error) {
      console.error(`Failed to verify function ${funcName}:`, error);
      return false;
    }
  }

  /**
   * Setup the dispose pattern for use with 'using' statement
   */
  [Symbol.dispose](): void {
    void this.cleanup();
  }

  /**
   * Support for async dispose
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }
}

/**
 * Utility function to create and set up a TestResource instance
 * Usage:
 * ```
 * using resources = await createTestResource();
 * ```
 */
export async function createTestResource(options?: { prefix?: string }): Promise<TestResource> {
  const resource = new TestResource(options);
  await resource.setup();
  return resource;
}
