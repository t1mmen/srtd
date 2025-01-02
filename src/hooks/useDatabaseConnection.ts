// hooks/useDatabaseConnection.ts
import { useEffect, useState } from 'react';
import { testConnection } from '../utils/databaseConnection.js';

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

    async function checkConnection() {
      if (!mounted) return;
      setState(prev => ({ ...prev, isChecking: true }));

      try {
        const isConnected = await testConnection();
        if (!mounted) return;
        setState({
          isConnected,
          error: undefined,
          isChecking: false,
        });
      } catch (err) {
        if (!mounted) return;
        setState({
          isConnected: false,
          error: parseDbError(err),
          isChecking: false,
        });
      }
    }

    void checkConnection();

    const intervalId = !state.isConnected ? setInterval(checkConnection, checkInterval) : undefined;

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkInterval, state.isConnected]);

  return state;
}
