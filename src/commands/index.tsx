// commands/index.tsx
import { Alert, Select, Spinner } from '@inkjs/ui';
import { Box, Text, useApp } from 'ink';
import React from 'react';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import { useDbConnection } from '../hooks/useDbConnection.js';
import { executeCommand } from '../utils/executeCommand.js';
import Apply from './apply.js';
import Build from './build.js';
import Register from './register.js';
import Watch from './watch.js';

export default function UI() {
  const { exit } = useApp();
  const { error, isChecking, isConnected } = useDbConnection();
  const [selectedCommand, setSelectedCommand] = React.useState<string | null>(null);
  const [isStarting, setIsStarting] = React.useState(false);
  const [errorStarting, setErrorStarting] = React.useState<string | null>(null);

  const handleOnChange = async (value: string) => {
    switch (value) {
      case 'startSupabase': {
        setIsStarting(true);
        const success = await executeCommand('supabase', ['start']).catch(() => {
          setIsStarting(false);
          setErrorStarting('Failed to start Supabase');
          return false;
        });

        setIsStarting(false);
        if (!success) {
          setErrorStarting('Failed to start Supabase');
          break;
        }
        // Wait a bit for the DB to be ready before letting the hook detect it
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
      default:
        setSelectedCommand(value);
        break;
    }
  };

  if (selectedCommand === 'register') {
    return <Register args={undefined} />;
  }

  if (selectedCommand === 'apply') {
    return <Apply options={{ force: false }} />;
  }

  if (selectedCommand === 'build') {
    return <Build options={{ force: false }} />;
  }

  if (selectedCommand === 'watch') {
    return <Watch />;
  }

  const menuItems = error
    ? [{ label: '▶️ Try starting Supabase', value: 'startSupabase' }]
    : [
        { label: '🏗️ build - Build Supabase migrations from templates', value: 'build' },
        { label: '▶️ apply - Apply migration templates directly to database', value: 'apply' },
        { label: '✍️ register - Register templates as already built', value: 'register' },
        {
          label: '👀 watch - Watch templates for changes and apply directly to database',
          value: 'watch',
        },
      ];

  return (
    <Box flexDirection="column">
      <Branding />
      <Select options={menuItems} onChange={handleOnChange} />
      <Box marginTop={1}>
        {isChecking ? (
          <Spinner label="Checking database connection..." />
        ) : errorStarting ? (
          <Alert variant="error">{errorStarting}</Alert>
        ) : isStarting ? (
          <Spinner label="Starting Supabase..." />
        ) : isConnected ? (
          <Text dimColor>Connected to database</Text>
        ) : (
          <Quittable onQuit={exit} />
        )}
      </Box>
    </Box>
  );
}
