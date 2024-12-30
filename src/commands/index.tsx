import { Select } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React from 'react';
import Apply from './apply.js';
import Build from './build.js';
import Register from './register.js';
import Watch from './watch.js';

export default function UI() {
  const [selectedCommand, setSelectedCommand] = React.useState<string | null>(null);

  // For now, we only demonstrate navigation to "register"
  if (selectedCommand === 'register') {
    return <Register args={undefined} />;
  }

  if (selectedCommand === 'apply') {
    return <Apply />;
  }

  if (selectedCommand === 'build') {
    return <Build />;
  }

  if (selectedCommand === 'watch') {
    return <Watch />;
  }

  const menuItems = [
    { label: '🏗️  build - Build Supabase migrations from templates', value: 'build' },
    { label: '▶️  apply - Apply migration templates directly to database', value: 'apply' },
    { label: '✍️  register - Register templates as already built', value: 'register' },
    {
      label: '👀  watch - Watch templates for changes and apply directly to database',
      value: 'watch',
    },
  ];

  return (
    <Box flexDirection="column">
      <Text bold>srtd - Repeatable Template SQL Migration Tool</Text>
      <Text>Select a command:</Text>
      <Box marginTop={1}>
        <Select options={menuItems} onChange={value => setSelectedCommand(value)} />
      </Box>
    </Box>
  );
}
