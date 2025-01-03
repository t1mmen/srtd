// utils/databaseConnection.ts
import pg from 'pg';
import { getConfig } from './config.js';
import { logger } from './logger.js';

let pool: pg.Pool | undefined;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000;

async function createPool(): Promise<pg.Pool> {
  // Only create a new pool if one doesn't exist or has been ended
  if (!pool || pool.ended) {
    const config = await getConfig(process.cwd());
    pool = new pg.Pool({
      connectionString: config.pgConnection,
      connectionTimeoutMillis: 2000,
      max: MAX_RETRIES,
      idleTimeoutMillis: 1000,
      maxUses: 500,
    });

    // Handle pool errors
    pool.on('error', err => {
      logger.error(`Unexpected pool error: ${err}`);
    });
  }
  return pool;
}

async function retryConnection(params?: { silent?: boolean }): Promise<pg.PoolClient> {
  const { silent = true } = params || {};
  connectionAttempts++;
  logger.debug(`Connection attempt ${connectionAttempts}`);

  try {
    const currentPool = await createPool();
    return await currentPool.connect();
  } catch (err) {
    if (connectionAttempts < MAX_RETRIES) {
      if (!silent) {
        logger.warn(`Connection failed, retrying in ${RETRY_DELAY}ms...`);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryConnection(params);
    }
    throw new Error(`Database connection failed after ${MAX_RETRIES} attempts: ${err}`);
  }
}

export async function connect(params?: { silent?: boolean }): Promise<pg.PoolClient> {
  connectionAttempts = 0;
  return await retryConnection(params);
}

export async function disconnect(): Promise<void> {
  if (!pool || pool.ended) return;

  try {
    await pool.end();
  } catch (e) {
    logger.error(`Pool end error: ${e}`);
  } finally {
    pool = undefined; // Important: clear the pool reference
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const client = await connect();
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

export function getConnectionStats() {
  if (!pool) return null;
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    active: pool.totalCount - pool.idleCount,
  };
}

// Handle process termination
function cleanup() {
  void disconnect().then(() => process.exit(0));
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
