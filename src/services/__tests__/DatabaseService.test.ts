/**
 * DatabaseService tests
 * Comprehensive unit and integration tests covering connection pooling,
 * transaction handling, error scenarios, and concurrent operations
 */

import { EventEmitter } from 'node:events';
import type { PoolClient } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorWithCode } from '../../__tests__/helpers/testUtils.js';
import {
  DatabaseErrorType,
  DatabaseService,
  type DatabaseServiceConfig,
} from '../DatabaseService.js';

// Mock pg module
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn();
const mockEnd = vi.fn();
const mockOn = vi.fn();

const mockClient = {
  query: mockQuery,
  release: mockRelease,
} as unknown as PoolClient;

const mockPool = {
  connect: mockConnect,
  end: mockEnd,
  on: mockOn,
  totalCount: 5,
  idleCount: 3,
  ended: false,
};

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => mockPool),
  },
}));

describe('DatabaseService', () => {
  let service: DatabaseService;
  let config: DatabaseServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      connectionString: 'postgresql://test:test@localhost:5432/test',
      maxRetries: 2,
      retryDelayMs: 100,
      connectionTimeoutMillis: 1000,
      maxConnections: 5,
      wrapInTransaction: false,
    };

    service = new DatabaseService(config);

    // Setup default mocks
    mockConnect.mockResolvedValue(mockClient);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockEnd.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('initialization and configuration', () => {
    it('should create service with default configuration', () => {
      const simpleService = new DatabaseService({
        connectionString: 'test://connection',
      });

      expect(simpleService).toBeInstanceOf(DatabaseService);
      expect(simpleService).toBeInstanceOf(EventEmitter);
    });

    it('should merge configuration with defaults', () => {
      const customConfig = {
        connectionString: 'test://connection',
        maxRetries: 5,
      };

      const customService = new DatabaseService(customConfig);
      expect(customService).toBeInstanceOf(DatabaseService);
    });

    it('should create service from CLI config', () => {
      const cliConfig = {
        pgConnection: 'postgresql://test:test@localhost:5432/test',
        wrapInTransaction: true,
        filter: '**/*.sql',
        wipIndicator: '.wip',
        banner: 'test',
        footer: 'test',
        templateDir: 'templates',
        migrationDir: 'migrations',
        migrationPrefix: 'test',
        buildLog: '.buildlog.json',
        localBuildLog: '.buildlog.local.json',
      };

      const fromConfigService = DatabaseService.fromConfig(cliConfig);
      expect(fromConfigService).toBeInstanceOf(DatabaseService);
    });
  });

  describe('connection management', () => {
    it('should establish database connection', async () => {
      const client = await service.connect();

      expect(mockConnect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });

    it('should retry connection on failure', async () => {
      const connectionError = new Error('Connection failed');
      mockConnect.mockRejectedValueOnce(connectionError).mockResolvedValueOnce(mockClient);

      const client = await service.connect({ silent: true });

      expect(mockConnect).toHaveBeenCalledTimes(2);
      expect(client).toBe(mockClient);
    });

    it('should fail after max retries', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockConnect.mockRejectedValue(connectionError);

      await expect(service.connect({ silent: true })).rejects.toThrow(
        'Database connection failed after 2 attempts'
      );

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should emit connection events', async () => {
      const connectionListener = vi.fn();
      const failedListener = vi.fn();

      service.on('connection:established', connectionListener);
      service.on('connection:failed', failedListener);

      await service.connect();
      expect(connectionListener).toHaveBeenCalled();

      // Test failure
      mockConnect.mockRejectedValue(new Error('Connection failed'));
      try {
        await service.connect({ silent: true });
      } catch {
        // Expected to fail
      }
      expect(failedListener).toHaveBeenCalled();
    });

    it('should test connection successfully', async () => {
      const isConnected = await service.testConnection();

      expect(isConnected).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should handle test connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      const isConnected = await service.testConnection();

      expect(isConnected).toBe(false);
    });

    it('should return connection statistics', async () => {
      // Need to establish a connection first to create the pool
      await service.connect();

      const stats = service.getConnectionStats();

      expect(stats).toEqual({
        total: 5,
        idle: 3,
        active: 2,
      });
    });

    it('should return null stats when no pool', async () => {
      await service.dispose();
      const stats = service.getConnectionStats();

      expect(stats).toBeNull();
    });
  });

  describe('SQL execution', () => {
    it('should execute SQL without transaction', async () => {
      const sql = 'SELECT * FROM users';
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValue(mockResult);

      const result = await service.executeSQL(sql, {
        useTransaction: false,
        silent: true,
      });

      expect(result.success).toBe(true);
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(result.rowCount).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(sql);
      expect(mockQuery).not.toHaveBeenCalledWith('BEGIN');
    });

    it('should execute SQL with transaction', async () => {
      const sql = 'INSERT INTO users (name) VALUES ($1)';
      const parameters = ['John'];
      const mockResult = { rows: [], rowCount: 1 };
      mockQuery.mockResolvedValue(mockResult);

      const result = await service.executeSQL(sql, {
        useTransaction: true,
        parameters,
        templateName: 'test-template',
        silent: true,
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith(sql, parameters);
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should handle SQL execution with advisory lock', async () => {
      const sql = 'UPDATE users SET name = $1';
      const mockResult = { rows: [], rowCount: 1 };
      mockQuery.mockResolvedValue(mockResult);

      await service.executeSQL(sql, {
        useTransaction: true,
        templateName: 'test-template',
        silent: true,
      });

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'));
      expect(mockQuery).toHaveBeenCalledWith(sql);
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should set isolation level when specified', async () => {
      const sql = 'SELECT * FROM users';
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await service.executeSQL(sql, {
        useTransaction: true,
        isolationLevel: 'SERIALIZABLE',
        silent: true,
      });

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    });

    it('should rollback on SQL error', async () => {
      const sql = 'INVALID SQL';
      const sqlError = createErrorWithCode('syntax error', '42601');

      mockQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(sqlError) // SQL execution
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await service.executeSQL(sql, {
        useTransaction: true,
        silent: true,
      });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.SYNTAX_ERROR);
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should emit SQL events', async () => {
      const successListener = vi.fn();
      const errorListener = vi.fn();

      service.on('sql:success', successListener);
      service.on('sql:error', errorListener);

      // Test success
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
      await service.executeSQL('SELECT 1', { silent: true });
      expect(successListener).toHaveBeenCalled();

      // Test error
      mockQuery.mockRejectedValue(new Error('SQL error'));
      await service.executeSQL('INVALID', { silent: true });
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('migration execution', () => {
    it('should execute migration successfully', async () => {
      const sql = 'CREATE TABLE test (id SERIAL)';
      const templateName = 'create-test-table';
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.executeMigration(sql, templateName, true);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    });

    it('should return migration error on failure', async () => {
      const sql = 'INVALID SQL';
      const templateName = 'invalid-template';
      const sqlError = new Error('syntax error');

      mockQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(sqlError); // SQL execution

      const result = await service.executeMigration(sql, templateName, true);

      expect(result).toEqual({
        file: templateName,
        error: expect.any(String),
        templateName,
      });
    });
  });

  describe('error categorization', () => {
    it('should categorize connection errors', async () => {
      const connectionError = createErrorWithCode('ECONNREFUSED', 'ECONNREFUSED');
      mockQuery.mockRejectedValue(connectionError);

      const result = await service.executeSQL('SELECT 1', { silent: true });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.CONNECTION_ERROR);
    });

    it('should categorize syntax errors', async () => {
      const syntaxError = createErrorWithCode('syntax error', '42601');
      mockQuery.mockRejectedValue(syntaxError);

      const result = await service.executeSQL('INVALID SQL', { silent: true });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.SYNTAX_ERROR);
    });

    it('should categorize constraint violations', async () => {
      const constraintError = createErrorWithCode('unique violation', '23505');
      mockQuery.mockRejectedValue(constraintError);

      const result = await service.executeSQL('INSERT...', { silent: true });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.CONSTRAINT_VIOLATION);
    });

    it('should categorize transaction errors', async () => {
      const transactionError = createErrorWithCode('deadlock detected', '40P01');
      mockQuery.mockRejectedValue(transactionError);

      const result = await service.executeSQL('UPDATE...', { silent: true });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.TRANSACTION_ERROR);
    });

    it('should categorize timeout errors', async () => {
      const timeoutError = createErrorWithCode('connection timeout', 'ETIMEOUT');
      mockQuery.mockRejectedValue(timeoutError);

      const result = await service.executeSQL('SELECT 1', { silent: true });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.TIMEOUT_ERROR);
    });

    it('should categorize pool exhaustion errors', async () => {
      const poolError = new Error('pool is exhausted');
      mockQuery.mockRejectedValue(poolError);

      const result = await service.executeSQL('SELECT 1', { silent: true });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.POOL_EXHAUSTED);
    });

    it('should categorize unknown errors', async () => {
      const unknownError = new Error('some unknown error');
      mockQuery.mockRejectedValue(unknownError);

      const result = await service.executeSQL('SELECT 1', { silent: true });

      expect(result.success).toBe(false);
      expect(result.databaseError?.type).toBe(DatabaseErrorType.UNKNOWN_ERROR);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent SQL executions', async () => {
      const sql = 'SELECT * FROM users WHERE id = $1';
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

      const promises = Array.from({ length: 5 }, (_, i) =>
        service.executeSQL(sql, {
          parameters: [i + 1],
          silent: true,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      for (const result of results) {
        expect(result.success).toBe(true);
      }
      expect(mockConnect).toHaveBeenCalledTimes(5);
      expect(mockRelease).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed success and failure scenarios', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockRejectedValueOnce(new Error('SQL error'))
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const promises = [
        service.executeSQL('SELECT 1', { silent: true }),
        service.executeSQL('INVALID', { silent: true }),
        service.executeSQL('SELECT 2', { silent: true }),
      ];

      const results = await Promise.all(promises);

      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(false);
      expect(results[2]?.success).toBe(true);
    });
  });

  describe('resource cleanup', () => {
    it('should dispose cleanly', async () => {
      // Need to create a pool first
      await service.connect();
      await service.dispose();

      expect(mockEnd).toHaveBeenCalled();
    });

    it('should handle disposal timeout', async () => {
      // Need to create a pool first
      await service.connect();

      const slowEndPromise = new Promise(resolve => {
        setTimeout(resolve, 2000); // Longer than timeout
      });
      mockEnd.mockReturnValue(slowEndPromise);

      await service.dispose();

      expect(mockEnd).toHaveBeenCalled();
    });

    it('should handle disposal errors', async () => {
      // Need to create a pool first
      await service.connect();

      mockEnd.mockRejectedValue(new Error('End failed'));

      await expect(service.dispose()).resolves.not.toThrow();
      expect(mockEnd).toHaveBeenCalled();
    });

    it('should emit pool events', async () => {
      const poolCreatedListener = vi.fn();
      const poolClosedListener = vi.fn();

      service.on('pool:created', poolCreatedListener);
      service.on('pool:closed', poolClosedListener);

      await service.connect();
      expect(poolCreatedListener).toHaveBeenCalled();

      await service.dispose();
      expect(poolClosedListener).toHaveBeenCalled();
    });

    it('should remove all listeners on disposal', async () => {
      const testListener = vi.fn();
      service.on('test', testListener);

      expect(service.listenerCount('test')).toBe(1);

      await service.dispose();

      expect(service.listenerCount('test')).toBe(0);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle rollback failure during transaction error', async () => {
      const sqlError = new Error('SQL error');
      const rollbackError = new Error('Rollback failed');

      mockQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(sqlError) // SQL execution
        .mockRejectedValueOnce(rollbackError); // ROLLBACK failure

      const result = await service.executeSQL('INVALID', {
        useTransaction: true,
        silent: true,
      });

      expect(result.success).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle empty and undefined parameters', async () => {
      const sql = 'SELECT 1';
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      // Test with empty config
      const result1 = await service.executeSQL(sql);
      expect(result1.success).toBe(true);

      // Test with empty parameters array
      const result2 = await service.executeSQL(sql, { parameters: [] });
      expect(result2.success).toBe(true);

      // Test with undefined parameters
      const result3 = await service.executeSQL(sql, { parameters: undefined });
      expect(result3.success).toBe(true);
    });

    it('should handle large result sets', async () => {
      const sql = 'SELECT * FROM large_table';
      const largeResult = {
        rows: Array.from({ length: 10000 }, (_, i) => ({ id: i })),
        rowCount: 10000,
      };
      mockQuery.mockResolvedValue(largeResult);

      const result = await service.executeSQL(sql, { silent: true });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(10000);
      expect(result.rowCount).toBe(10000);
    });

    it('should handle very long SQL statements', async () => {
      const longSql = `SELECT ${'col, '.repeat(1000)}1`;
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.executeSQL(longSql, { silent: true });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(longSql);
    });
  });
});
