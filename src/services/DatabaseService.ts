/**
 * DatabaseService - Centralized database connection and SQL execution service
 * Handles connection pooling, retry logic, and SQL execution with transaction management
 */

import { EventEmitter } from 'node:events';
import pg from 'pg';
import type { CLIConfig, MigrationError } from '../types.js';
import { logger } from '../utils/logger.js';

export interface DatabaseServiceConfig {
  connectionString: string;
  connectionTimeoutMillis?: number;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  maxUses?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  wrapInTransaction?: boolean;
}

export interface ConnectionStats {
  total: number;
  idle: number;
  active: number;
}

export enum DatabaseErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  POOL_EXHAUSTED = 'POOL_EXHAUSTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface DatabaseError {
  type: DatabaseErrorType;
  message: string;
  originalError?: Error;
  code?: string;
  detail?: string;
}

export interface SqlExecutionResult {
  success: boolean;
  error?: string;
  databaseError?: DatabaseError;
  rows?: unknown[];
  rowCount?: number;
  data?: unknown;
}

export interface ExecutionConfig {
  templateName?: string;
  useTransaction?: boolean;
  silent?: boolean;
  parameters?: unknown[];
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
}

export class DatabaseService extends EventEmitter {
  private config: DatabaseServiceConfig;
  private pool: pg.Pool | undefined;
  private connectionAttempts = 0;
  private disposed = false;

  constructor(config: DatabaseServiceConfig) {
    super();
    this.config = {
      connectionTimeoutMillis: 5000,
      maxConnections: 6, // Default maxRetries * 2
      idleTimeoutMillis: 2000,
      maxUses: 500,
      maxRetries: 3,
      retryDelayMs: 500,
      wrapInTransaction: false,
      ...config,
    };
    // Note: No process signal handlers here - cleanup is handled by the owner
    // (Orchestrator or command) via the dispose() method and 'await using' pattern.
    // This prevents race conditions with multiple handlers.
  }

  /**
   * Categorize database errors for better error handling
   */
  private categorizeError(error: unknown): DatabaseError {
    const pgError = error as { code?: string; message?: string };
    const errorCode = pgError?.code;
    const errorMessage = pgError?.message || String(error);

    // Connection errors
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || errorCode === 'ECONNRESET') {
      return {
        type: DatabaseErrorType.CONNECTION_ERROR,
        message: 'Database connection failed',
        originalError: error instanceof Error ? error : new Error(String(error)),
        code: errorCode,
        detail: errorMessage,
      };
    }

    // Pool exhaustion
    if (errorMessage.includes('pool is exhausted') || errorMessage.includes('too many clients')) {
      return {
        type: DatabaseErrorType.POOL_EXHAUSTED,
        message: 'Database connection pool exhausted',
        originalError: error instanceof Error ? error : new Error(String(error)),
        code: errorCode,
        detail: errorMessage,
      };
    }

    // Timeout errors
    if (errorCode === 'ETIMEOUT' || errorMessage.includes('timeout')) {
      return {
        type: DatabaseErrorType.TIMEOUT_ERROR,
        message: 'Database operation timed out',
        originalError: error instanceof Error ? error : new Error(String(error)),
        code: errorCode,
        detail: errorMessage,
      };
    }

    // PostgreSQL specific error codes
    if (errorCode) {
      // Syntax errors (42xxx)
      if (errorCode.startsWith('42')) {
        return {
          type: DatabaseErrorType.SYNTAX_ERROR,
          message: 'SQL syntax error',
          originalError: error instanceof Error ? error : new Error(String(error)),
          code: errorCode,
          detail: errorMessage,
        };
      }

      // Constraint violations (23xxx)
      if (errorCode.startsWith('23')) {
        return {
          type: DatabaseErrorType.CONSTRAINT_VIOLATION,
          message: 'Database constraint violation',
          originalError: error instanceof Error ? error : new Error(String(error)),
          code: errorCode,
          detail: errorMessage,
        };
      }

      // Transaction errors (25xxx, 40xxx)
      if (errorCode.startsWith('25') || errorCode.startsWith('40')) {
        return {
          type: DatabaseErrorType.TRANSACTION_ERROR,
          message: 'Transaction error',
          originalError: error instanceof Error ? error : new Error(String(error)),
          code: errorCode,
          detail: errorMessage,
        };
      }
    }

    // Default to unknown error
    return {
      type: DatabaseErrorType.UNKNOWN_ERROR,
      message: errorMessage,
      originalError: error instanceof Error ? error : new Error(String(error)),
      code: errorCode,
      detail: errorMessage,
    };
  }

  /**
   * Create and configure database connection pool
   */
  private async createPool(): Promise<pg.Pool> {
    // Only create a new pool if one doesn't exist or has been ended
    if (!this.pool || this.pool.ended) {
      this.pool = new pg.Pool({
        connectionString: this.config.connectionString,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        max: this.config.maxConnections,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        maxUses: this.config.maxUses,
      });

      // Handle pool errors
      this.pool.on('error', err => {
        const errorMessage = `Unexpected pool error: ${err}`;
        logger.error(errorMessage);
        this.emit('error', new Error(errorMessage));
      });

      this.emit('pool:created');
    }
    return this.pool;
  }

  /**
   * Establish database connection with retry logic
   */
  private async retryConnection(params?: { silent?: boolean }): Promise<pg.PoolClient> {
    const { silent = true } = params || {};
    this.connectionAttempts++;
    logger.debug(`Connection attempt ${this.connectionAttempts}`);

    try {
      const currentPool = await this.createPool();
      const client = await currentPool.connect();
      this.emit('connection:established');
      return client;
    } catch (err) {
      if (this.connectionAttempts < (this.config.maxRetries ?? 3)) {
        if (!silent) {
          logger.warn(`Connection failed, retrying in ${this.config.retryDelayMs}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
        return this.retryConnection(params);
      }
      const databaseError = this.categorizeError(err);
      const error = new Error(
        `Database connection failed after ${this.config.maxRetries} attempts: ${databaseError.message}`
      );
      this.emit('connection:failed', { error, databaseError });
      throw error;
    }
  }

  /**
   * Get a database connection with retry logic
   */
  async connect(params?: { silent?: boolean }): Promise<pg.PoolClient> {
    this.connectionAttempts = 0;
    return await this.retryConnection(params);
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.connect({ silent: true });
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  }

  /**
   * Execute SQL with optional transaction wrapping and parameterized queries
   * Core method for running template content or any SQL
   */
  async executeSQL(sql: string, config?: ExecutionConfig): Promise<SqlExecutionResult> {
    const {
      templateName = 'unknown',
      useTransaction = this.config.wrapInTransaction,
      silent = false,
      parameters = [],
      isolationLevel,
    } = config || {};

    const client = await this.connect({ silent });

    try {
      if (useTransaction) {
        await client.query('BEGIN');

        // Set isolation level if specified
        if (isolationLevel) {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
        }

        // Use advisory lock for templates to prevent concurrent modifications
        if (templateName !== 'unknown') {
          const lockKey = Math.abs(Buffer.from(templateName).reduce((acc, byte) => acc + byte, 0));
          await client.query(`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);
        }
      }

      // Execute with or without parameters for security
      const result =
        parameters.length > 0 ? await client.query(sql, parameters) : await client.query(sql);

      if (useTransaction) {
        await client.query('COMMIT');
      }

      if (!silent) {
        logger.success(`SQL executed successfully for ${templateName}`);
      }

      this.emit('sql:success', { templateName, rowCount: result.rowCount });

      return {
        success: true,
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
        data: result.rows,
      };
    } catch (error) {
      if (useTransaction) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error(`Rollback failed: ${rollbackError}`);
        }
      }

      const databaseError = this.categorizeError(error);
      const errorMessage = databaseError.message;

      if (!silent) {
        logger.error(
          `SQL execution failed for ${templateName}: ${errorMessage} (${databaseError.type})`
        );
      }

      this.emit('sql:error', { templateName, error: errorMessage, errorType: databaseError.type });

      return {
        success: false,
        error: errorMessage,
        databaseError,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Execute SQL and return migration-compatible result
   * Used by migration/template application logic
   */
  async executeMigration(
    content: string,
    templateName: string,
    silent = false
  ): Promise<true | MigrationError> {
    const result = await this.executeSQL(content, {
      templateName,
      useTransaction: true,
      silent,
      isolationLevel: 'READ COMMITTED', // Safe default for migrations
    });

    if (result.success) {
      return true;
    }

    return {
      file: templateName,
      error: result.error || 'Unknown error',
      templateName,
    };
  }

  /**
   * Get connection pool statistics
   */
  getConnectionStats(): ConnectionStats | null {
    if (!this.pool) return null;
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      active: this.pool.totalCount - this.pool.idleCount,
    };
  }

  /**
   * Gracefully close all database connections
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    if (this.pool && !this.pool.ended) {
      try {
        // Suppress errors during shutdown
        this.pool.on('error', () => {
          // Empty handler on purpose
        });

        // End the pool with a timeout
        const endPromise = this.pool.end();
        const timeoutPromise = new Promise<void>(resolve => {
          setTimeout(() => {
            logger.debug('Pool end timed out, proceeding anyway');
            resolve();
          }, 1000);
        });

        await Promise.race([endPromise, timeoutPromise]);
        this.emit('pool:closed');
      } catch (e) {
        logger.error(`Pool end error: ${e}`);
        // Don't re-throw disposal errors, just log them
      } finally {
        this.pool = undefined; // Important: clear the pool reference
      }
    }

    // Remove all listeners
    this.removeAllListeners();
  }

  /**
   * Create DatabaseService from CLI config
   */
  static fromConfig(config: CLIConfig): DatabaseService {
    return new DatabaseService({
      connectionString: config.pgConnection,
      wrapInTransaction: config.wrapInTransaction,
    });
  }
}
