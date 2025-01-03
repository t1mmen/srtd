import { Alert, MultiSelect } from '@inkjs/ui';
import figures from 'figures';
import { Box, Text, useInput } from 'ink';
import { argument } from 'pastel';
import React from 'react';
import zod from 'zod';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import { COLOR_ERROR, COLOR_SUCCESS, COLOR_WARNING } from '../components/customTheme.js';
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
  const [showAll, setShowAll] = React.useState(false);

  useInput(input => {
    if (input === 'r') {
      setShowAll(!showAll);
    }
  });

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

  const renderStatus = () => {
    if (!errorMessage && !successMessage) return null;
    return (
      <Box flexDirection="column" marginTop={1}>
        {!!errorMessage && (
          <Text color={COLOR_ERROR}>
            {figures.cross} {errorMessage}
          </Text>
        )}
        {!!successMessage && (
          <Text color={COLOR_SUCCESS}>
            {figures.tick} {successMessage}
          </Text>
        )}
      </Box>
    );
  };

  const isDone = !!successMessage || !!errorMessage;
  // If no templates were provided as arguments, show interactive selection
  if (!templateArgs?.length && !isDone) {
    const options = items
      .filter(t => {
        if (showAll) return true;
        return !t.buildState.lastMigrationFile;
      })
      .sort((a, b) => {
        // If a template has a last migration file, it's considered registered, and sort it last.
        if (a.buildState.lastMigrationFile && !b.buildState.lastMigrationFile) return 1;
        if (!a.buildState.lastMigrationFile && b.buildState.lastMigrationFile) return -1;
        return a.name.localeCompare(b.name);
      })
      .map(t => {
        const status = t.buildState.lastMigrationFile ? 'registered' : 'new';
        return {
          label: `${t.name} (${status})`,
          value: t.path,
        };
      });

    return (
      <Box flexDirection="column">
        <Branding subtitle="✍️ Register templates" />

        <Box gap={2}>
          {options.length === 0 ? (
            <Box flexDirection="column">
              <Text color={COLOR_WARNING}>{figures.warning} No templates found</Text>
              {!showAll && !!items.length && (
                <Text dimColor>{figures.info} Press r to show registered templates</Text>
              )}
              {!items.length && (
                <Text>
                  {figures.info}
                  Start by creating a template in the templates directory.
                </Text>
              )}
            </Box>
          ) : (
            <>
              <Text>
                {selectedValues.length} / {options.length} selected
              </Text>
              <Text dimColor>Use arrow/space to select, then press Enter to register.</Text>
            </>
          )}
        </Box>
        <Box marginTop={1} marginBottom={1}>
          <MultiSelect
            visibleOptionCount={30}
            options={options}
            onChange={vals => setSelectedValues(vals)}
            onSubmit={vals => handleTemplateRegistration(vals)}
          />
          {renderStatus()}
        </Box>
        <Box gap={1}>
          <Quittable />
          <Box marginY={1} gap={1}>
            <Text dimColor>•</Text>
            <Text dimColor>Press</Text>
            <Text underline={showAll}>r</Text>
            {showAll ? (
              <Text dimColor>to hide registered templates</Text>
            ) : (
              <Text dimColor>to show registered templates</Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  return renderStatus();
}
