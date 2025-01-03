import { Select, Spinner } from '@inkjs/ui';
import figures from 'figures';
import { Box, Text, useApp } from 'ink';
import React from 'react';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import { COLOR_SUCCESS } from '../components/customTheme.js';
import { clearBuildLogs, resetConfig } from '../utils/config.js';
const clearOptions = [
  { label: 'Clear local build logs', value: 'local' },
  { label: 'Clear shared build logs', value: 'shared' },
  { label: 'Reset config and logs to initial defaults', value: 'full_reset' },
];

export default function Clear() {
  const { exit } = useApp();
  const [isResetting, setIsResetting] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);

  const handleSelect = async (value: string) => {
    try {
      setIsResetting(true);
      switch (value) {
        case 'local':
          await clearBuildLogs(process.cwd(), 'local');
          break;
        case 'shared':
          await clearBuildLogs(process.cwd(), 'shared');
          break;
        case 'full_reset':
          await resetConfig(process.cwd());
          await clearBuildLogs(process.cwd(), 'both');
          break;
        default:
          throw new Error('Invalid option');
      }
      setIsDone(true);
      setIsResetting(false);
      exit();
    } catch (err) {
      exit(err instanceof Error ? err : new Error('Unknown error occurred'));
    }
  };

  return (
    <>
      <Branding subtitle="🧹 Maintenance" />
      <Select options={clearOptions} onChange={handleSelect} />
      {isDone ? (
        <Box marginY={1}>
          <Text color={COLOR_SUCCESS}>{figures.tick} Reset complete. Exiting</Text>
        </Box>
      ) : isResetting ? (
        <Box marginY={1}>
          <Spinner label="Resetting..." />
        </Box>
      ) : (
        <Quittable />
      )}
    </>
  );
}
