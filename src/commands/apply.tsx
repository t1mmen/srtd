// src/commands/apply.tsx
import { Spinner } from '@inkjs/ui';
import { Box, useApp } from 'ink';
import { option } from 'pastel';
import React from 'react';
import zod from 'zod';
import Branding from '../components/Branding.js';
import { ProcessingResults } from '../components/ProcessingResults.js';
import { useTemplateProcessor } from '../hooks/useTemplateProcessor.js';

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
  const { result, isProcessing } = useTemplateProcessor({
    force: options.force,
    apply: true,
    onComplete: () => exit(), // Move exit here
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Branding subtitle="▶️  Apply migrations" />
      {isProcessing ? (
        <Spinner label="Applying templates..." />
      ) : (
        <ProcessingResults result={result} showApply />
      )}
    </Box>
  );
}
