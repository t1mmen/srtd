// src/commands/apply.tsx
import { Spinner } from '@inkjs/ui';
import { Box, Text, useApp } from 'ink';
import { option } from 'pastel';
import React from 'react';
import zod from 'zod';
import { COLOR_ERROR } from '../components/customTheme.js';
import { TemplateManager } from '../lib/templateManager.js';
import { disconnect } from '../utils/databaseConnection.js';

export const options = zod.object({
  force: zod.boolean().describe(
    option({
      description: 'Force apply of all templates, irrespective of changes',
      alias: 'f',
    })
  ),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Apply({ options }: Props) {
  const { exit } = useApp();
  const [status, setStatus] = React.useState<{
    applied: number;
    errors: number;
    completed: boolean;
  }>({
    applied: 0,
    errors: 0,
    completed: false,
  });

  React.useEffect(() => {
    async function doApply() {
      try {
        const manager = await TemplateManager.create(process.cwd());
        const result = await manager.processTemplates({ apply: true, force: options.force });

        setStatus({
          applied: result.applied.length,
          errors: result.errors.length,
          completed: true,
        });

        await disconnect();
        exit();
      } catch (err) {
        await disconnect();
        exit(err instanceof Error ? err : new Error(String(err)));
      }
    }

    void doApply();
  }, [exit, options]);

  if (!status.completed) {
    return <Spinner label="Applying templates..." />;
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text>
        Applied {status.applied} template(s)
        {status.errors > 0 && <Text color={COLOR_ERROR}>, {status.errors} error(s)</Text>}
      </Text>
      <Spinner label="Disconnecting..." />
    </Box>
  );
}
