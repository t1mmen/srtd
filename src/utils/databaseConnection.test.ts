import { describe, expect, it } from 'vitest';
import { connect, disconnect } from './databaseConnection.js';

describe('db.connection', () => {
  it('should connect and execute queries', async () => {
    const client = await connect();
    const result = await client.query('SELECT 1 as num');
    expect(result.rows[0].num).toBe(1);
    client.release();
  });

  it('should reuse the same pool for multiple connections', async () => {
    const client1 = await connect();
    const client2 = await connect();

    await client1.query('SELECT 1');
    await client2.query('SELECT 1');

    client1.release();
    client2.release();
  });

  it('should handle connection release properly', async () => {
    const client1 = await connect();
    client1.release();

    const client2 = await connect();
    await client2.query('SELECT 1');
    client2.release();
  });

  it('should handle disconnection properly', async () => {
    const client = await connect();
    await client.query('SELECT 1');
    client.release();

    await disconnect();

    // Should be able to connect again
    const newClient = await connect();
    await newClient.query('SELECT 1');
    newClient.release();
  });

  it('should handle multiple disconnects gracefully', async () => {
    const client = await connect();
    client.release();

    await disconnect();
    await disconnect(); // Should not error
  });
});
