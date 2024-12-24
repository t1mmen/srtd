import React from 'react';
import { Box, Text } from 'ink';
import { MultiSelect } from '@inkjs/ui';
import { useTemplateState } from '../hooks/useTemplateState';
import { registerTemplate } from '../utils/registerTemplate';

export default function Register() {
  const { loading, error, items } = useTemplateState();
  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  const [registering, setRegistering] = React.useState(false);
  const [doneMessage, setDoneMessage] = React.useState('');

  async function handleSubmit(vals: string[]) {
    setRegistering(true);
    setDoneMessage('');

    let successCount = 0;
    let failCount = 0;

    for (const path of vals) {
      try {
        await registerTemplate(path, process.cwd());
        successCount++;
      } catch {
        failCount++;
      }
    }

    setDoneMessage(`Successfully registered ${successCount} template(s). Failed: ${failCount}`);

    setRegistering(false);
    process.exit(0);
  }

  if (loading) {
    return <Text>Loading templates...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }
  const options = items.map(t => {
    const status = t.buildState.lastMigrationFile ? 'registered' : 'new';
    return {
      label: `${t.name} (${status})`,
      value: t.path,
    };
  });

  return (
    <Box flexDirection="column">
      <Text bold>Register Templates</Text>
      <Text>Use arrow/space to select, then press Enter to register.</Text>
      <Box marginTop={1}>
        <Text color="white">
          {selectedValues.length} / {options.length} selected
        </Text>
      </Box>
      <Box marginTop={1} marginBottom={1}>
        <MultiSelect
          options={options}
          onChange={vals => setSelectedValues(vals)}
          onSubmit={vals => handleSubmit(vals)}
        />
      </Box>
      {registering && <Text>Registering…</Text>}
      {doneMessage && <Text color="green">{doneMessage}</Text>}
    </Box>
  );
}
