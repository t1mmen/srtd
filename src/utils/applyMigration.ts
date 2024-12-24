import chalk from 'chalk';
import { MigrationError } from '../rtsql/rtsql.types';
import { connect } from './db.connection';

export async function applyMigration(
  content: string,
  templateName: string
): Promise<true | MigrationError> {
  const client = await connect();
  try {
    await client.query('BEGIN');

    // Create advisory lock
    const lockKey = Math.abs(Buffer.from(templateName).reduce((acc, byte) => acc + byte, 0));
    await client.query(`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);

    await client.query(content);

    await client.query('COMMIT');

    console.log(`  ✅ ${chalk.green('Applied successfully')}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.log(`  ❌ ${chalk.red('Failed to apply:')} ${error}`);
    return {
      file: templateName,
      error: error as string,
      templateName,
    };
  } finally {
    client.release();
  }
}
