import React from 'react';
import { Box, Text } from 'ink';
import { TemplateStatus } from '../rtsql/rtsql.types';
import { StatusIndicator } from './StatusIndicator';
import { calculateTemplateState } from '../utils/templateState';
import { getTimeAgo } from '../rtsql/rtsql.utils';

interface TemplateListProps {
  items: TemplateStatus[];
}

export function TemplateList({ items }: TemplateListProps) {
  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return getTimeAgo(new Date(date));
  };

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginY={1}>
        <Box width={25}>
          <Text bold>Template</Text>
        </Box>
        <Box width={15}>
          <Text bold>Build Status</Text>
        </Box>
        <Box width={15}>
          <Text bold>Apply Status</Text>
        </Box>
        <Box width={15}>
          <Text bold>Last Built</Text>
        </Box>
        <Box width={15}>
          <Text bold>Last Applied</Text>
        </Box>
      </Box>

      {/* Items */}
      {items.map(item => {
        const state = calculateTemplateState(item);
        return (
          <Box key={item.path} flexDirection="column">
            {/* Template row */}
            <Box>
              <Box width={25}>
                <Text>{item.name}</Text>
              </Box>
              <StatusIndicator state={state} />
              <Box width={15}>
                <Text dimColor>{formatDate(item.buildState.lastBuildDate)}</Text>
              </Box>
              <Box width={15}>
                <Text dimColor>{formatDate(item.buildState.lastAppliedDate)}</Text>
              </Box>
            </Box>
            {/* Error messages */}
            {(state.buildMessage || state.applyMessage) && (
              <Box marginLeft={2} marginBottom={1}>
                {state.buildMessage && <Text color="red">Build: {state.buildMessage}</Text>}
                {state.applyMessage && <Text color="red">Apply: {state.applyMessage}</Text>}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
