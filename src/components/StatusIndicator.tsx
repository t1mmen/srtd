import React from 'react';
import { Box, Text } from 'ink';
import { TemplateStateInfo } from '../types.js';
import {
  getBuildStatusColor,
  getApplyStatusColor,
  getApplyStatusIcon,
  getBuildStatusIcon,
} from '../utils/templateState.js';

interface StatusIndicatorProps {
  state: TemplateStateInfo;
}

export function StatusIndicator({ state }: StatusIndicatorProps) {
  // Move existing getStatusIndicator here
  return (
    <Box>
      <Box width={15}>
        <Text color={getBuildStatusColor(state.buildStatus)}>
          {getBuildStatusIcon(state.buildStatus)}
        </Text>
      </Box>
      <Box width={15}>
        <Text color={getApplyStatusColor(state.applyStatus)}>
          {getApplyStatusIcon(state.applyStatus)}
        </Text>
      </Box>
    </Box>
  );
}
