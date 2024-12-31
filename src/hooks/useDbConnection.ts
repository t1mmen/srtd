// hooks/useDbConnection.ts
import { useEffect, useState } from 'react';
import { connect, disconnect } from '../utils/databaseConnection.js';
import { logger } from '../utils/logger.js';

interface DbConnectionState {
  isConnected: boolean;
  isChecking: boolean;
  error?: string;
}

function parseDbError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Connection terminated unexpectedly')) {
      return 'Database connection lost. Is Supabase running?';
    }
    if (error.message.includes('ECONNREFUSED')) {
      return 'Unable to connect to database. Is Supabase running?';
    }
    return error.message.split('\n')[0] || error.message;
  }
  return String(error);
}

export function useDbConnection(checkInterval = 5000): DbConnectionState {
  const [state, setState] = useState<DbConnectionState>({
    isConnected: false,
    isChecking: true,
  });

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    async function checkConnection() {
      // Reset checking state for each attempt
      if (mounted) {
        setState(prev => ({ ...prev, isChecking: true }));
      }

      try {
        // Set a timeout for the connection attempt
        const connectionPromise = new Promise<void>((resolve, reject) => {
          connect()
            .then(client => {
              return client
                .query('SELECT 1')
                .then(() => client.release())
                .then(resolve)
                .catch(reject);
            })
            .catch(reject);
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Connection attempt timed out'));
          }, 3000); // 3 second timeout
        });

        await Promise.race([connectionPromise, timeoutPromise]);

        if (mounted) {
          setState({
            isConnected: true,
            error: undefined,
            isChecking: false,
          });
        }
      } catch (err) {
        if (mounted) {
          setState({
            isConnected: false,
            error: parseDbError(err),
            isChecking: false,
          });
          logger.debug(`DB connection error: ${err}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    checkConnection();
    const intervalId = setInterval(checkConnection, checkInterval);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      disconnect().catch(() => {
        // Ignore disconnection errors on cleanup
      });
    };
  }, [checkInterval]);

  return state;
}
