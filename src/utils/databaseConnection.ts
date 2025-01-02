// utils/databaseConnection.ts
import pg from 'pg';
import { getConfig } from './config.js';
import { logger } from './logger.js';

let pool: pg.Pool | undefined;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000;

async function createPool(): Promise<pg.Pool> {
  const config = await getConfig(process.cwd());
  const newPool = new pg.Pool({
    connectionString: config.pgConnection,
    connectionTimeoutMillis: 2000,
    max: MAX_RETRIES,
    idleTimeoutMillis: 1000,
    maxUses: 500,
  });

  // Handle pool errors
  newPool.on('error', err => {
    logger.error(`Unexpected pool error: ${err}`);
  });

  return newPool;
}

async function retryConnection(params?: { silent?: boolean }): Promise<pg.PoolClient> {
  const { silent = true } = params || {};
  connectionAttempts++;
  logger.debug(`Connection attempt ${connectionAttempts}`);

  try {
    if (!pool) pool = await createPool();
    return await pool.connect();
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
  return retryConnection(params);
}

export async function disconnect(): Promise<void> {
  if (!pool) return;

  try {
    await pool.end();
  } catch (e) {
    logger.error(`Pool end error: ${e}`);
  } finally {
    pool = undefined;
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
