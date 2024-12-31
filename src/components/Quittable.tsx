import { Box, Text, useApp, useInput } from 'ink';
import React from 'react';

type Props = {
  onQuit?: () => void;
};

export default function Quittable(props?: Props) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input.toLowerCase() === 'q' || (key.ctrl && input === 'c')) {
      props?.onQuit?.();
      setTimeout(() => exit(), 0);
    }
  });

  return (
    <Box>
      <Text dimColor>press </Text>
      <Text>q</Text>
      <Text dimColor> or </Text>
      <Text>Ctrl+c</Text>
      <Text dimColor> to quit</Text>
    </Box>
  );
}
