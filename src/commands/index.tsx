import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';

// Import the "Register" component for demonstration of navigation:
import Register from './register';
import Apply from './apply';
import Build from './build';
import Status from './status';
import Watch from './watch';

export default function UI() {
  const [selectedCommand, setSelectedCommand] = React.useState<string | null>(null);

  // For now, we only demonstrate navigation to "register"
  if (selectedCommand === 'register') {
    return <Register />;
  }

  if (selectedCommand === 'apply') {
    return <Apply />;
  }

  if (selectedCommand === 'build') {
    return <Build />;
  }

  if (selectedCommand === 'status') {
    return <Status />;
  }

  if (selectedCommand === 'watch') {
    return <Watch />;
  }

  // Single-choice interactive menu
  const menuItems = [
    { label: 'build - Build migrations from templates', value: 'build' },
    { label: 'apply - Build & apply migrations', value: 'apply' },
    { label: 'register - Register templates as applied', value: 'register' },
    { label: 'watch - Watch templates for changes', value: 'watch' },
    { label: 'status - Show migration status', value: 'status' },
  ];

  return (
    <Box flexDirection="column">
      <Text bold>RTSQL - Repeatable Template SQL Migration Tool</Text>
      <Text>Select a command:</Text>
      <Box marginTop={1}>
        <Select options={menuItems} onChange={value => setSelectedCommand(value)} />
      </Box>
    </Box>
  );
}
