import { MultiSelect } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { argument } from 'pastel';
import React from 'react';
import zod from 'zod';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import { COLOR_ERROR, COLOR_SUCCESS } from '../components/customTheme.js';
import { useTemplateState } from '../hooks/useTemplateState.js';
import { registerTemplate } from '../utils/registerTemplate.js';

// Support both array of filenames as arguments and interactive selection
export const args = zod
  .array(zod.string())
  .optional()
  .describe(
    argument({
      name: 'templates',
      description: 'Template files to register (optional)',
    })
  );

type Props = {
  args: zod.infer<typeof args>;
};

export default function Register({ args: templateArgs }: Props) {
  const { error, items } = useTemplateState();
  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  const handleTemplateRegistration = React.useCallback(async (templates: string[]) => {
    setSuccessMessage('');
    setErrorMessage('');

    let successCount = 0;
    let failCount = 0;

    for (const path of templates) {
      try {
        await registerTemplate(path, process.cwd());
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (failCount > 0) {
      setErrorMessage(`Failed to register ${failCount} template(s).`);
    }
    if (successCount > 0) {
      setSuccessMessage(`Successfully registered ${successCount} template(s).`);
    }

    process.exit(failCount > 0 ? 1 : 0);
  }, []);

  React.useEffect(() => {
    // If templates were provided as arguments, register them directly
    if (templateArgs?.length) {
      handleTemplateRegistration(templateArgs);
    }
  }, [handleTemplateRegistration, templateArgs]);

  if (error) {
    return <Text color={COLOR_ERROR}>Error: {error}</Text>;
  }

  // If no templates were provided as arguments, show interactive selection
  if (!templateArgs?.length) {
    const options = items.map(t => {
      const status = t.buildState.lastMigrationFile ? 'registered' : 'new';
      return {
        label: `${t.name} (${status})`,
        value: t.path,
      };
    });

    return (
      <Box flexDirection="column">
        <Branding subtitle="Register templates" />

        <Box gap={2}>
          <Text>
            {selectedValues.length} / {options.length} selected
          </Text>
          <Text dimColor>Use arrow/space to select, then press Enter to register.</Text>
        </Box>
        <Box marginTop={1} marginBottom={1}>
          <MultiSelect
            options={options}
            onChange={vals => setSelectedValues(vals)}
            onSubmit={vals => handleTemplateRegistration(vals)}
          />
        </Box>
        {!!errorMessage && <Text color={COLOR_ERROR}>{errorMessage}</Text>}
        {!!successMessage && <Text color={COLOR_SUCCESS}>{successMessage}</Text>}
        <Quittable />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {!!errorMessage && <Text color={COLOR_ERROR}>{errorMessage}</Text>}
      {!!successMessage && <Text color={COLOR_SUCCESS}>{successMessage}</Text>}
      <Quittable />
    </Box>
  );
}
