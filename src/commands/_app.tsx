import React from 'react';
import type { AppProps } from 'pastel';
import { Box } from 'ink';

export default function App({ Component, commandProps }: AppProps) {
  return (
    <Box flexDirection="column">
      <Component {...commandProps} />
    </Box>
  );
}
