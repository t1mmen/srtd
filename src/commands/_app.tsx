import { Alert, ThemeProvider, defaultTheme, extendTheme } from '@inkjs/ui';
import { Box, Static, Text, type TextProps } from 'ink';
import type { AppProps } from 'pastel';
import React from 'react';
import { useDatabaseConnection } from '../hooks/useDatabaseConnection.js';

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
  const { error } = useDatabaseConnection();

  return (
    <ThemeProvider theme={customTheme}>
      <Box flexDirection="column" padding={1}>
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
      </Box>
    </ThemeProvider>
  );
}

// Mimick fullscreen behavior
const enterAltScreenCommand = '\x1b[?1049h';
const leaveAltScreenCommand = '\x1b[?1049l';
process.stdout.write(enterAltScreenCommand);
process.on('exit', () => {
  process.stdout.write(leaveAltScreenCommand);
});
