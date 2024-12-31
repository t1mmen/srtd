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
  return new pg.Pool({
    connectionString: config.pgConnection,
    connectionTimeoutMillis: 500,
  });
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
  if (pool) {
    // Add poolPendingCount check to avoid hanging on
    // pending queries during shutdown
    if (pool.totalCount !== pool.idleCount) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await pool.end();
    pool = undefined;
  }
  return;
}

export async function testConnection(): Promise<boolean> {
  try {
    const client = await connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

process.on('exit', async () => await disconnect());
