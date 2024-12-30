import type { PoolClient } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyMigration } from './applyMigration.js';
import { connect } from './db.connection.js';

describe('applyMigration', () => {
  let client: PoolClient;
  const testContext = {
    timestamp: Date.now(),
    testFunctionName: '',
  };

  beforeAll(async () => {
    client = await connect();
  });

  beforeEach(async () => {
    testContext.testFunctionName = `test_func_${testContext.timestamp}`;
    await client.query('BEGIN');
    await client.query(`DROP FUNCTION IF EXISTS ${testContext.testFunctionName}()`);
    await client.query('COMMIT');
  });

  afterEach(async () => {
    await client.query('BEGIN');
    await client.query(`DROP FUNCTION IF EXISTS ${testContext.testFunctionName}()`);
    await client.query('COMMIT');
  });

  it('should successfully apply valid SQL', async () => {
    const sql = `
      CREATE FUNCTION ${testContext.testFunctionName}()
      RETURNS void AS $$
      BEGIN NULL; END;
      $$ LANGUAGE plpgsql;
    `;

    const result = await applyMigration(sql, 'test-template');
    expect(result).toBe(true);

    // Verify function exists
    const res = await client.query(`SELECT proname FROM pg_proc WHERE proname = $1`, [
      testContext.testFunctionName,
    ]);
    expect(res.rows).toHaveLength(1);
  });

  it('should fail and rollback on invalid SQL', async () => {
    const sql = 'INVALID SQL SYNTAX';
    const result = await applyMigration(sql, 'test-template');
    expect(result).not.toBe(true);
    expect(result).toMatchObject({
      file: 'test-template',
      error: expect.stringMatching(/syntax error/i),
    });
  });

  it('should handle concurrent migrations with advisory locks', async () => {
    const client2 = await connect();
    const sql = `
      DO $$
      BEGIN
        PERFORM pg_sleep(0.1);
        RAISE NOTICE 'Executed after delay';
      END $$;
    `;

    // Start two concurrent migrations
    const [result1, result2] = await Promise.all([
      applyMigration(sql, 'test-template'),
      applyMigration(sql, 'test-template'),
    ]);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    client2.release();
  });

  it('should handle transactions properly', async () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS test_table_${testContext.timestamp} (id serial);
      SELECT 1/0; -- Force error
    `;

    const result = await applyMigration(sql, 'test-template');
    expect(result).not.toBe(true);
    expect(result).toMatchObject({
      error: expect.stringMatching(/division by zero/i),
    });

    // Verify table wasn't created (rollback worked)
    const res = await client.query(
      `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = $1
      )`,
      [`test_table_${testContext.timestamp}`]
    );
    expect(res.rows[0].exists).toBe(false);
  });

  it('should handle large SQL statements', async () => {
    // Generate a large SQL statement
    const statements = Array(1000)
      .fill(0)
      .map((_, i) => `SELECT ${i} as number;`)
      .join('\n');

    const result = await applyMigration(statements, 'test-template');
    expect(result).toBe(true);
  });

  it('should handle errors in stored procedures', async () => {
    const sql = `
      CREATE OR REPLACE FUNCTION ${testContext.testFunctionName}()
      RETURNS void AS $$
      BEGIN
        RAISE EXCEPTION 'Custom error message';
      END;
      $$ LANGUAGE plpgsql;

      SELECT ${testContext.testFunctionName}();
    `;

    const result = await applyMigration(sql, 'test-template');
    expect(result).not.toBe(true);
    expect(result).toMatchObject({
      error: expect.stringMatching(/Custom error message/),
    });
  });
});
