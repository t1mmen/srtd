import { Box } from 'ink';
import type { AppProps } from 'pastel';
import React from 'react';

export default function App({ Component, commandProps }: AppProps) {
  return (
    <Box flexDirection="column">
      <Component {...commandProps} />
    </Box>
  );
}
