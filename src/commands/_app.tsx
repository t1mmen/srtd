import { Alert, ThemeProvider, defaultTheme, extendTheme } from '@inkjs/ui';
import { Box, Static, Text, type TextProps } from 'ink';
import type { AppProps } from 'pastel';
import React from 'react';
import { useDbConnection } from '../hooks/useDbConnection.js';

const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: (): TextProps => ({
          color: 'magenta',
        }),
      },
    },
  },
});

export default function App({ Component, commandProps }: AppProps) {
  const { error } = useDbConnection();

  return (
    <ThemeProvider theme={customTheme}>
      {!!error && (
        <Static items={[error]}>
          {error => (
            <Box key={error}>
              <Alert variant="error">
                <Text bold color="red">
                  Error:{' '}
                </Text>
                {error}
              </Alert>
            </Box>
          )}
        </Static>
      )}
      <Component {...commandProps} />
    </ThemeProvider>
  );
}
