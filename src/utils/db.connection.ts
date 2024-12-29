// utils/db.connection.ts
import pg from 'pg';
import { getConfig } from './config.js';
import { logger } from './logger.js';

let pool: pg.Pool | undefined;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function createPool(): Promise<pg.Pool> {
  const config = await getConfig(process.cwd());
  return new pg.Pool({
    connectionString: config.pgConnection,
    connectionTimeoutMillis: 5000,
  });
}

async function retryConnection(): Promise<pg.PoolClient> {
  connectionAttempts++;
  logger.debug(`Connection attempt ${connectionAttempts}`);

  try {
    if (!pool) pool = await createPool();
    return await pool.connect();
  } catch (err) {
    if (connectionAttempts < MAX_RETRIES) {
      logger.warn(`Connection failed, retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryConnection();
    }
    throw new Error(`Database connection failed after ${MAX_RETRIES} attempts: ${err}`);
  }
}

export async function connect(): Promise<pg.PoolClient> {
  connectionAttempts = 0;
  return retryConnection();
}

export async function disconnect(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

process.on('exit', () => pool?.end());
