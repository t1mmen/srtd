/**
 * Database E2E Tests - Real Postgres validation
 *
 * These tests validate srtd's end-to-end behavior against a real Postgres database.
 * They use the TestResource scaffolding for test isolation and cleanup.
 *
 * REQUIREMENTS:
 * - Postgres must be running (via `npm run supabase:start`)
 * - Tests run sequentially to prevent DB connection contention
 * - Each test has its own isolated test environment
 *
 * Run with: npm run test:e2e:db
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PG_CONNECTION } from '../../constants.js';
import { Orchestrator } from '../../services/Orchestrator.js';
import { createTestResource, type TestResource } from '../helpers/TestResource.js';
import { getTestDatabaseService } from '../vitest.setup.js';

// Connection string for tests (env var overrides default for CI)
const POSTGRES_URL = process.env.POSTGRES_URL || DEFAULT_PG_CONNECTION;

/**
 * Redact credentials from a PostgreSQL connection URL for safe logging.
 * Replaces username:password with *****:***** to prevent credential exposure.
 * Handles passwords containing @ by matching the last @ before the host.
 */
function redactCredentials(url: string): string {
  // Match: protocol://credentials@host where we split on the LAST @
  // This handles passwords containing @ characters (e.g., p@ssword)
  const match = url.match(/^(\w+:\/\/)(.+)@([^@]+)$/);
  if (match) {
    return `${match[1]}*****:*****@${match[3]}`;
  }
  return url;
}

/**
 * Prerequisite check - fail fast if database is not available.
 * This runs before all tests in this file.
 */
beforeAll(async () => {
  try {
    const db = await getTestDatabaseService();
    // Test connection by executing a simple query
    const client = await db.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  } catch (error) {
    // SECURITY: Redact credentials from error message to prevent exposure in logs
    throw new Error(
      `Database E2E tests require a running Postgres instance.\n` +
        `Run: npm run supabase:start\n` +
        `Connection: ${redactCredentials(POSTGRES_URL)}\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

afterAll(async () => {
  // Cleanup is handled by vitest.setup.ts
});

/**
 * Helper to create an Orchestrator with test configuration.
 */
async function createTestOrchestrator(
  testDir: string,
  options: { silent?: boolean } = {}
): Promise<Orchestrator> {
  const orchestrator = await Orchestrator.create(
    testDir,
    {
      templateDir: 'test-templates',
      migrationDir: 'test-migrations',
      filter: '**/*.sql',
      wipIndicator: '.wip',
      wrapInTransaction: true,
      banner: '-- SRTD Test Migration',
      footer: '-- End of migration',
      buildLog: '.buildlog.json',
      localBuildLog: '.buildlog.local.json',
      pgConnection: POSTGRES_URL,
    },
    { silent: options.silent ?? true }
  );
  return orchestrator;
}

describe.sequential('Database E2E Tests', () => {
  describe.sequential('Template Apply Operations', () => {
    let resources: TestResource | undefined;

    it('should apply a simple function template to database', async () => {
      resources = await createTestResource({ prefix: 'apply-simple' });

      try {
        // Create template with a simple function
        const templatePath = await resources.createTemplateWithFunc('simple', '_v1');

        // Verify function doesn't exist yet
        const existsBefore = await resources.verifyFunctionExists('_v1');
        expect(existsBefore).toBe(false);

        // Create orchestrator and apply
        const orchestrator = await createTestOrchestrator(resources.testDir);

        try {
          const result = await orchestrator.apply({ templatePaths: [templatePath] });

          // Should apply exactly 1 template without errors
          expect(result.errors).toHaveLength(0);
          expect(result.applied).toHaveLength(1);
          expect(result.skipped).toHaveLength(0);

          // Verify function now exists in database
          const existsAfter = await resources.verifyFunctionExists('_v1');
          expect(existsAfter).toBe(true);
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });

    it('should update function when template content changes', async () => {
      resources = await createTestResource({ prefix: 'apply-update' });

      try {
        const funcSuffix = '_update';
        const funcName = `${resources.testFunctionName}${funcSuffix}`;

        // Create initial template
        const templatePath = await resources.createTemplate(
          'update-test.sql',
          `CREATE OR REPLACE FUNCTION ${funcName}() RETURNS text AS $$ BEGIN RETURN 'version1'; END; $$ LANGUAGE plpgsql;`
        );

        // Apply initial version
        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          await orchestrator.apply({ templatePaths: [templatePath] });

          // Verify initial version
          const initialResult = await resources.withTransaction(async client => {
            const res = await client.query(`SELECT ${funcName}() as result`);
            return res.rows[0]?.result;
          });
          expect(initialResult).toBe('version1');

          // Update template content
          await fs.writeFile(
            templatePath,
            `CREATE OR REPLACE FUNCTION ${funcName}() RETURNS text AS $$ BEGIN RETURN 'version2'; END; $$ LANGUAGE plpgsql;`
          );

          // Apply updated version
          await orchestrator.apply({ templatePaths: [templatePath] });

          // Verify updated version
          const updatedResult = await resources.withTransaction(async client => {
            const res = await client.query(`SELECT ${funcName}() as result`);
            return res.rows[0]?.result;
          });
          expect(updatedResult).toBe('version2');
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });

    it('should handle SQL syntax errors gracefully', async () => {
      resources = await createTestResource({ prefix: 'apply-error' });

      try {
        // Create template with invalid SQL syntax
        const templatePath = await resources.createTemplate(
          'invalid.sql',
          'CREATE FUNCTION broken( RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;'
        );

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          const result = await orchestrator.apply({ templatePaths: [templatePath] });

          // Should report exactly 1 error
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0]?.error).toBeDefined();
          expect(result.applied).toHaveLength(0);
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });

    it('should rollback transaction on error when wrapInTransaction is true', async () => {
      resources = await createTestResource({ prefix: 'apply-rollback' });

      try {
        const tableName = `${resources.testFunctionName}_table`;

        // Create template that creates table then fails
        const templatePath = await resources.createTemplate(
          'rollback-test.sql',
          `
            CREATE TABLE ${tableName} (id INT);
            -- This will fail because the table doesn't exist
            SELECT * FROM nonexistent_table_${resources.testId};
          `
        );

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          await orchestrator.apply({ templatePaths: [templatePath] });

          // Verify table was rolled back (should not exist)
          const tableExists = await resources.withTransaction(async client => {
            const result = await client.query(
              `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
              [tableName]
            );
            return (result.rowCount ?? 0) > 0;
          });

          expect(tableExists).toBe(false);
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });
  });

  describe.sequential('Template Build Operations', () => {
    let resources: TestResource | undefined;

    it('should build migration file with correct content', async () => {
      resources = await createTestResource({ prefix: 'build' });

      try {
        // Create template
        const templatePath = await resources.createTemplateWithFunc('build', '_build');

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          const result = await orchestrator.build({ templatePaths: [templatePath] });

          // Should build exactly 1 migration without errors
          expect(result.errors).toHaveLength(0);
          expect(result.built).toHaveLength(1);
          expect(result.skipped).toHaveLength(0);

          // Verify exactly 1 migration file was created
          const migrationsDir = path.join(resources.testDir, 'test-migrations');
          const files = await fs.readdir(migrationsDir);
          expect(files).toHaveLength(1);

          // Verify migration content includes banner
          const firstFile = files[0];
          expect(firstFile).toBeDefined();
          const migrationContent = await fs.readFile(path.join(migrationsDir, firstFile), 'utf-8');
          expect(migrationContent).toContain('-- SRTD Test Migration');
          expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION');
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });

    it('should update buildlog after successful build', async () => {
      resources = await createTestResource({ prefix: 'buildlog' });

      try {
        // Create template
        const templatePath = await resources.createTemplateWithFunc('buildlog', '_log');
        const buildlogPath = path.join(resources.testDir, '.buildlog.json');

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          const result = await orchestrator.build({ templatePaths: [templatePath] });

          // Verify build succeeded
          expect(result.errors).toHaveLength(0);
          expect(result.built).toHaveLength(1);
        } finally {
          // dispose() flushes pending auto-save operations
          await orchestrator.dispose();
        }

        // Verify buildlog was created (check AFTER dispose flushes pending saves)
        const buildlogExists = await fs
          .access(buildlogPath)
          .then(() => true)
          .catch(() => false);
        expect(buildlogExists).toBe(true);

        // Verify buildlog has correct structure
        const buildlog = JSON.parse(await fs.readFile(buildlogPath, 'utf-8'));
        expect(buildlog).toHaveProperty('version');
        expect(buildlog).toHaveProperty('lastTimestamp');
        expect(buildlog).toHaveProperty('templates');
      } finally {
        if (resources) await resources.cleanup();
      }
    });
  });

  describe.sequential('State Management', () => {
    let resources: TestResource | undefined;

    it('should track template state correctly after apply', async () => {
      resources = await createTestResource({ prefix: 'state' });

      try {
        // Create template
        const templatePath = await resources.createTemplateWithFunc('state', '_state');
        const localBuildlogPath = path.join(resources.testDir, '.buildlog.local.json');

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          // Apply template
          const result = await orchestrator.apply({ templatePaths: [templatePath] });

          // Verify apply succeeded
          expect(result.applied).toHaveLength(1);
          expect(result.errors).toHaveLength(0);
        } finally {
          // dispose() flushes pending auto-save operations
          await orchestrator.dispose();
        }

        // Verify local buildlog was updated (check AFTER dispose flushes pending saves)
        const localBuildlogExists = await fs
          .access(localBuildlogPath)
          .then(() => true)
          .catch(() => false);
        expect(localBuildlogExists).toBe(true);

        const localBuildlog = JSON.parse(await fs.readFile(localBuildlogPath, 'utf-8'));
        expect(Object.keys(localBuildlog.templates)).toHaveLength(1);
      } finally {
        if (resources) await resources.cleanup();
      }
    });

    it('should skip unchanged templates on re-apply', async () => {
      resources = await createTestResource({ prefix: 'skip' });

      try {
        // Create template
        const templatePath = await resources.createTemplateWithFunc('skip', '_skip');

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          // First apply - should apply exactly 1
          const result1 = await orchestrator.apply({ templatePaths: [templatePath] });
          expect(result1.applied).toHaveLength(1);
          expect(result1.skipped).toHaveLength(0);
          expect(result1.errors).toHaveLength(0);

          // Second apply - should skip exactly 1 (unchanged)
          const result2 = await orchestrator.apply({ templatePaths: [templatePath] });
          expect(result2.applied).toHaveLength(0);
          expect(result2.skipped).toHaveLength(1);
          expect(result2.errors).toHaveLength(0);
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });
  });

  describe.sequential('Complex SQL Operations', () => {
    let resources: TestResource | undefined;

    it('should handle complex function with parameters and return types', async () => {
      resources = await createTestResource({ prefix: 'complex' });

      try {
        // Create complex template
        const templatePath = await resources.createComplexSQLTemplate('complex', '_complex');

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          const result = await orchestrator.apply({ templatePaths: [templatePath] });

          // Should apply exactly 1 complex template
          expect(result.errors).toHaveLength(0);
          expect(result.applied).toHaveLength(1);
          expect(result.skipped).toHaveLength(0);

          // Verify complex function exists and works
          const funcName = `${resources.testFunctionName}_complex`;
          const queryResult = await resources.withTransaction(async client => {
            const res = await client.query(`SELECT * FROM ${funcName}(50)`);
            return res.rows[0];
          });

          expect(queryResult).toHaveProperty('result1');
          expect(queryResult).toHaveProperty('result2');
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });
  });

  describe.sequential('WIP Template Handling', () => {
    let resources: TestResource | undefined;

    it('should apply WIP templates to local database', async () => {
      // WIP templates ARE applied locally - that's their purpose (local development)
      resources = await createTestResource({ prefix: 'wip-apply' });

      try {
        // Create WIP template (with .wip in the name)
        const wipPath = await resources.createTemplate(
          'work-in-progress.wip.sql',
          `CREATE OR REPLACE FUNCTION ${resources.testFunctionName}_wip() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`
        );

        // Create regular template
        const regularPath = await resources.createTemplateWithFunc('regular', '_regular');

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          const result = await orchestrator.apply({
            templatePaths: [wipPath, regularPath],
          });

          // Both should be applied - WIP templates are applied to local DB
          expect(result.applied.length).toBe(2);
          expect(result.skipped.length).toBe(0);

          // Verify both functions exist
          const wipExists = await resources.verifyFunctionExists('_wip');
          expect(wipExists).toBe(true);

          const regularExists = await resources.verifyFunctionExists('_regular');
          expect(regularExists).toBe(true);
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });

    it('should skip WIP templates during build', async () => {
      // WIP templates are NOT built to migrations - they're not ready for deployment
      resources = await createTestResource({ prefix: 'wip-build' });

      try {
        // Create WIP template
        const wipPath = await resources.createTemplate(
          'work-in-progress.wip.sql',
          `CREATE OR REPLACE FUNCTION ${resources.testFunctionName}_wip() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`
        );

        // Create regular template
        const regularPath = await resources.createTemplateWithFunc('regular', '_regular');

        const orchestrator = await createTestOrchestrator(resources.testDir);
        try {
          const result = await orchestrator.build({
            templatePaths: [wipPath, regularPath],
          });

          // WIP should be skipped, regular should be built
          expect(result.built.length).toBe(1);
          expect(result.skipped.length).toBe(1);
        } finally {
          await orchestrator.dispose();
        }
      } finally {
        if (resources) await resources.cleanup();
      }
    });
  });
});
