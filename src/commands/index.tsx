// commands/index.tsx
import { Select } from '@inkjs/ui';
import { Box } from 'ink';
import React from 'react';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import Apply from './apply.js';
import Build from './build.js';
import Clear from './clear.js';
import Register from './register.js';
import Watch from './watch.js';

export default function UI() {
  const [selectedCommand, setSelectedCommand] = React.useState<string | null>(null);

  const handleOnChange = async (value: string) => {
    setSelectedCommand(value);
  };

  if (selectedCommand === 'register') {
    return <Register args={undefined} />;
  }

  if (selectedCommand === 'apply') {
    return <Apply options={{ force: false }} />;
  }

  if (selectedCommand === 'build') {
    return <Build options={{ force: false }} />;
  }

  if (selectedCommand === 'watch') {
    return <Watch />;
  }

  if (selectedCommand === 'clear') {
    return <Clear />;
  }

  const menuItems = [
    {
      label: '👀  watch - Watch for changes, apply directly to db',
      value: 'watch',
    },
    { label: '▶️  apply - Apply templates directly to db', value: 'apply' },
    { label: '🏗️  build - Build templates as Supabase migrations', value: 'build' },
    { label: '✍️  register - Register templates as already built', value: 'register' },
    { label: '🧹  maintenance - Clear build logs and reset config', value: 'clear' },
  ];

  return (
    <Box flexDirection="column">
      <Branding />
      <Select options={menuItems} onChange={handleOnChange} />
      <Quittable />
    </Box>
  );
}
