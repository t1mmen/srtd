// src/commands/_app.tsx
import { Alert, ThemeProvider } from '@inkjs/ui';
import { Box, Static, Text } from 'ink';
import type { AppProps } from 'pastel';
import React from 'react';
import Debug from '../components/Debug.js';
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
