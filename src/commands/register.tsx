import React from 'react';
import { Box, Text } from 'ink';
import { MultiSelect } from '@inkjs/ui';
import { loadTemplates, registerTemplate } from '../rtsql/rtsql.utils';
import { TemplateState } from '../rtsql/rtsql.types';

export default function Register() {
  const [state, setState] = React.useState<TemplateState>({
    items: [],
    loading: true,
  });
  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  const [registering, setRegistering] = React.useState(false);
  const [doneMessage, setDoneMessage] = React.useState('');

  async function loadTemplatesData() {
    try {
      const templateEntities = await loadTemplates(process.cwd());
      setState({ items: templateEntities, loading: false });
    } catch (error) {
      setState(s => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  React.useEffect(() => {
    loadTemplatesData();
  }, []);

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
    await loadTemplatesData(); // Refresh status
    setRegistering(false);
    process.exit(0);
  }

  if (state.loading) {
    return <Text>Loading templates...</Text>;
  }

  if (state.error) {
    return <Text color="red">Error: {state.error}</Text>;
  }

  const options = state.items.map(t => ({
    label: `${t.name}${
      t.status === 'registered' ? ' (registered)' : t.status === 'modified' ? ' (modified)' : ''
    }`,
    value: t.path,
  }));

  return (
    <Box flexDirection="column">
      <Text bold>Register Templates</Text>
      <Text>Use arrow/space to select, then press Enter to register.</Text>
      <Box marginTop={1}>
        <Text color="white">
          {selectedValues.length} / {options.length} selected
        </Text>
      </Box>
      <Box marginTop={1}>
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
