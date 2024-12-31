import process from 'node:process';
import { Box, Text, useInput } from 'ink';
import React from 'react';

interface QuittableProps {
  onQuit?: () => void;
}

export default function Quittable(props: QuittableProps) {
  // Use ref to track if component is mounted
  const mounted = React.useRef(true);

  React.useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useInput((input, key) => {
    if (!mounted.current) return;

    if (input.toLowerCase() === 'q' || (key.ctrl && input === 'c')) {
      try {
        if (props?.onQuit) {
          props.onQuit();
        }
        // Exit synchronously
        process.exit(0);
      } catch (error) {
        console.error('Failed to exit cleanly:', error);
        process.exit(1);
      }
    }
  });

  return (
    <Box marginY={1}>
      <Text dimColor>press </Text>
      <Text>q</Text>
      <Text dimColor> or </Text>
      <Text>Ctrl+c</Text>
      <Text dimColor> to quit</Text>
    </Box>
  );
}
