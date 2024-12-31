import { Badge } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React from 'react';
import packageJson from '../../package.json' assert { type: 'json' };
import { useDbConnection } from '../hooks/useDbConnection.js';

type Props = {
  subtitle?: string;
};

export default function Branding({ subtitle }: Props) {
  const { error, isConnected } = useDbConnection();

  const badgeColor = error ? 'red' : isConnected ? '#3ecf8e' : 'yellow';
  return (
    <Box marginBottom={1} marginTop={1} gap={1} flexDirection="column">
      <Box gap={1}>
        <Badge color={badgeColor}> srtd </Badge>
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
