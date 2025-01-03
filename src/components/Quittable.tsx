import { Box, Text, useApp, useInput } from 'ink';
import React from 'react';

interface QuittableProps {
  onQuit?: () => void;
}

export default function Quittable(props: QuittableProps) {
  // Use ref to track if component is mounted
  const { exit } = useApp();
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
        exit();
      } catch (error) {
        console.error('Failed to exit cleanly:', error);
        if (error instanceof Error) {
          exit(error);
        }
      }
    }
  });

  return (
    <Box marginY={1}>
      <Text dimColor>Press </Text>
      <Text>q</Text>
      <Text dimColor> or </Text>
      <Text>Ctrl+c</Text>
      <Text dimColor> to quit</Text>
    </Box>
  );
}
