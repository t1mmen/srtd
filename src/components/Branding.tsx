import { Badge } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React from 'react';
import packageJson from '../../package.json' assert { type: 'json' };
import { useDatabaseConnection } from '../hooks/useDatabaseConnection.js';
import { COLOR_ERROR, COLOR_SUPABASE, COLOR_WARNING } from './customTheme.js';

type Props = {
  subtitle?: string;
};

export default function Branding({ subtitle }: Props) {
  const { error, isConnected } = useDatabaseConnection();

  const badgeColor = error ? COLOR_ERROR : isConnected ? COLOR_SUPABASE : COLOR_WARNING;
  return (
    <Box marginBottom={1} marginTop={1} gap={1} flexDirection="column">
      <Box gap={1}>
        <Badge color={badgeColor}> srtd </Badge>
        {subtitle ? (
          <Text>{subtitle}</Text>
        ) : (
          <Text>
            <Text bold color={COLOR_SUPABASE}>
              S
            </Text>
            upabase{' '}
            <Text bold color={COLOR_SUPABASE}>
              R
            </Text>
            epeatable{' '}
            <Text bold color={COLOR_SUPABASE}>
              T
            </Text>
            emplate{' '}
            <Text bold color={COLOR_SUPABASE}>
              D
            </Text>
            efinitions
          </Text>
        )}
        <Text dimColor> v{packageJson.version}</Text>
      </Box>
    </Box>
  );
}
