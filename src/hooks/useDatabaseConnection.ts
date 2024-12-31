// hooks/useDatabaseConnection.ts
import { useEffect, useState } from 'react';
import { RETRY_DELAY, testConnection } from '../utils/databaseConnection.js';

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

export function useDatabaseConnection(checkInterval = 5000): DbConnectionState {
  const [state, setState] = useState<DbConnectionState>({
    isConnected: false,
    isChecking: true,
  });

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout | undefined = undefined;

    async function checkConnection() {
      if (!mounted) return;
      setState(prev => ({ ...prev, isChecking: true }));

      try {
        const connectionPromise = testConnection();
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Connection attempt timed out'));
          }, RETRY_DELAY);
        });

        const isConnected = await Promise.race([connectionPromise, timeoutPromise]);

        if (mounted) {
          setState({
            isConnected,
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
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    checkConnection();
    intervalId = setInterval(checkConnection, checkInterval);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [checkInterval]);

  return state;
}
