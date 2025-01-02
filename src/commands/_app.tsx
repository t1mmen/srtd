// src/commands/_app.tsx
import { Alert, ThemeProvider } from '@inkjs/ui';
import Debug from 'components/Debug.js';
import { Box, Static, Text } from 'ink';
import type { AppProps } from 'pastel';
import React from 'react';
import { COLOR_ERROR, customTheme } from '../components/customTheme.js';
import { useDatabaseConnection } from '../hooks/useDatabaseConnection.js';

export default function App({ Component, commandProps }: AppProps) {
  const { error } = useDatabaseConnection();

  return (
    <ThemeProvider theme={customTheme}>
      <Box flexDirection="column" padding={1}>
        {!!error && (
          <Static items={[error]}>
            {error => (
              <Box key={error}>
                <Alert variant="error">
                  <Text bold color={COLOR_ERROR}>
                    Error:{' '}
                  </Text>
                  {error}
                </Alert>
              </Box>
            )}
          </Static>
        )}
        <Component {...commandProps} />
        <Debug />
      </Box>
    </ThemeProvider>
  );
}

// Fullscreen behavior
const enterAltScreenCommand = '\x1b[?1049h';
const leaveAltScreenCommand = '\x1b[?1049l';
process.stdout.write(enterAltScreenCommand);

const cleanup = () => {
  process.stdout.write(leaveAltScreenCommand);
};

process.on('exit', cleanup);
