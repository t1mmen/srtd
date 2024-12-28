import chalk from 'chalk';
import pg from 'pg';
import { getConfig } from './config.js';
const { Pool } = pg;

let pool: pg.Pool | undefined;

async function setup() {
  const config = await getConfig(process.cwd());
  if (!pool) {
    pool = new Pool({ connectionString: config.pgConnection });
  }
}

export async function connect() {
  await setup();
  if (!pool) {
    throw new Error('Failed to connect to database');
  }
  const client = await pool.connect().catch(error => {
    console.error(`  ❌ ${chalk.red('Failed to connect to database')}`);
    console.error(error);
    process.exit(1);
  });
  return client;
}

// Cleanup on process exit
process.on('exit', () => {
  if (pool) {
    pool.end();
  }
});
