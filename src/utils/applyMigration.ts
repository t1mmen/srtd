import { MigrationError } from '../types.js';
import { connect } from './db.connection.js';
import { logger } from './logger.js';

export async function applyMigration(
  content: string,
  templateName: string
): Promise<true | MigrationError> {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const lockKey = Math.abs(Buffer.from(templateName).reduce((acc, byte) => acc + byte, 0));
    await client.query(`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);

    await client.query(content);
    await client.query('COMMIT');

    logger.success('Migration applied successfully');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Migration failed: ${error}`);
    return {
      file: templateName,
      error: error as string,
      templateName,
    };
  } finally {
    client.release();
  }
}
