import React from 'react';
import { Text, Box } from 'ink';
import zod from 'zod';

export const options = zod.object({
  name: zod.string().default('Stranger').describe('Name'),
  verbose: zod.boolean().default(false).describe('Show detailed output'),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Index({ options }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold>RTSQL - Repeatable Template SQL Migration Tool</Text>
      <Text>Available commands:</Text>
      <Box marginLeft={2} flexDirection="column">
        <Text>
          <Text bold>build</Text> - Build migrations from templates
        </Text>
        <Text>
          <Text bold>apply</Text> - Build & apply migrations to database
        </Text>
        <Text>
          <Text bold>register</Text> - Register templates as applied
        </Text>
        <Text>
          <Text bold>watch</Text> - Watch templates and apply changes
        </Text>
      </Box>
    </Box>
  );
}
