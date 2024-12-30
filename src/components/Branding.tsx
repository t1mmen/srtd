import { Box, Text } from 'ink';
import React from 'react';
import packageJson from '../../package.json' assert { type: 'json' };

type Props = {
  subtitle?: string;
};

export default function Branding({ subtitle }: Props) {
  return (
    <Box marginBottom={1} marginTop={1} gap={1} flexDirection="column">
      <Box gap={1}>
        <Text bold backgroundColor="#3ecf8e">
          {' '}
          srtd{' '}
        </Text>
        {subtitle ? (
          <Text>{subtitle}</Text>
        ) : (
          <Text>
            (
            <Text bold color="#3ecf8e">
              S
            </Text>
            upabase{' '}
            <Text bold color="#3ecf8e">
              R
            </Text>
            epeatable{' '}
            <Text bold color="#3ecf8e">
              T
            </Text>
            emplate{' '}
            <Text bold color="#3ecf8e">
              D
            </Text>
            efinitions)
          </Text>
        )}
        <Text dimColor>v{packageJson.version}</Text>
      </Box>
    </Box>
  );
}
