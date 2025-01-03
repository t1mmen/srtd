// src/components/watch.tsx
import { Badge } from '@inkjs/ui';
import { Box } from 'ink';
import React from 'react';

export function StatBadge({
  label,
  value,
  color,
}: { label: string; value: number; color: string }) {
  return (
    <Box marginRight={1}>
      <Badge color={color}>
        {' '}
        {label}: {value}{' '}
      </Badge>
    </Box>
  );
}
