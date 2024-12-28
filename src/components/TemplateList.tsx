import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TemplateStatus, TemplateStateInfo } from '../types.js';
import { StatusIndicator } from './StatusIndicator.js';
import { calculateTemplateState } from '../utils/templateState.js';
import { getTimeAgo } from '../utils/getTimeAgo.js';

interface TemplateListProps {
  items: TemplateStatus[];
}

interface TemplateWithState {
  template: TemplateStatus;
  state: TemplateStateInfo;
}

export function TemplateList({ items }: TemplateListProps) {
  const [templateStates, setTemplateStates] = useState<TemplateWithState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStates = async () => {
      const states = await Promise.all(
        items.map(async item => ({
          template: item,
          state: await calculateTemplateState(item),
        }))
      );
      setTemplateStates(states);
      setIsLoading(false);
    };
    loadStates();
  }, [items]);

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return getTimeAgo(new Date(date));
  };

  if (isLoading) {
    return (
      <Box>
        <Text>Loading templates...</Text>
      </Box>
    );
  }

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
      {templateStates.map(({ template, state }) => (
        <Box key={template.path} flexDirection="column">
          <Box>
            <Box width={25}>
              <Text>{template.name}</Text>
            </Box>
            <StatusIndicator state={state} />
            <Box width={15}>
              <Text dimColor>{formatDate(template.buildState.lastBuildDate)}</Text>
            </Box>
            <Box width={15}>
              <Text dimColor>{formatDate(template.buildState.lastAppliedDate)}</Text>
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
      ))}
    </Box>
  );
}
