import { Select } from '@inkjs/ui';
import { Box } from 'ink';
import React from 'react';
import Branding from '../components/Branding.js';
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
    return <Build options={{ force: false }} />;
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
      <Branding />
      <Select options={menuItems} onChange={value => setSelectedCommand(value)} />
    </Box>
  );
}
