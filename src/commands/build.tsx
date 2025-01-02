// commands/build.tsx
import { Spinner } from '@inkjs/ui';
import { Box, Text, useApp, useInput } from 'ink';
import { option } from 'pastel';
import React from 'react';
import zod from 'zod';
import Branding from '../components/Branding.js';
import { ProcessingResults } from '../components/ProcessingResults.js';
import { useTemplateProcessor } from '../hooks/useTemplateProcessor.js';

export const options = zod.object({
  force: zod.boolean().describe(
    option({
      description: 'Force building of all templates, irrespective of changes',
      alias: 'f',
    })
  ),
  apply: zod
    .boolean()
    .optional()
    .describe(
      option({
        description: 'Apply the built templates',
        alias: 'a',
      })
    ),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Build({ options }: Props) {
  const { exit } = useApp();
  const { result, isProcessing } = useTemplateProcessor({
    force: options.force,
    generateFiles: true,
    apply: options.apply,
  });

  useInput((_input, _) => {
    if (!isProcessing) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Branding subtitle="🏗️  Build migrations" />
      {isProcessing ? (
        <Spinner label="Building templates..." />
      ) : (
        <>
          <ProcessingResults result={result} showBuild showApply={!!option.apply} />
          <Text dimColor>Press any key to exit</Text>
        </>
      )}
    </Box>
  );
}
