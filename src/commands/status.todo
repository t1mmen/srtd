import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { getTimeAgo } from '../utils/getTimeAgo.js';
import { loadTemplates } from '../utils/loadTemplates.js';
import { TemplateStatus, TemplateStateInfo } from '../types.js';
import { calculateTemplateState } from '../utils/templateState.js';
import { StatusIndicator } from '../components/StatusIndicator.js';

interface TemplateWithState {
  template: TemplateStatus;
  state: TemplateStateInfo;
}

export default function Status() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [templateStates, setTemplateStates] = React.useState<TemplateWithState[]>([]);

  React.useEffect(() => {
    async function fetchStatus() {
      try {
        const dirname = process.cwd();
        const templates = await loadTemplates(dirname);
        const buildLog = await loadBuildLog(dirname, 'common');
        const localBuildLog = await loadBuildLog(dirname, 'local');

        const combined: TemplateStatus[] = templates.map(t => {
          const relPath = path.relative(dirname, t.path);
          const buildState = {
            ...buildLog.templates[relPath],
            ...localBuildLog.templates[relPath],
          };

          return {
            name: t.name,
            path: relPath,
            currentHash: t.currentHash,
            migrationHash: t.migrationHash,
            buildState,
          };
        });

        // Calculate states for all templates
        const states = await Promise.all(
          combined.map(async item => ({
            template: item,
            state: await calculateTemplateState(item),
          }))
        );
        setTemplateStates(states);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return getTimeAgo(new Date(date));
  };

  if (loading) return <Text>Loading status…</Text>;
  if (error) return <Text color="red">Error: {error}</Text>;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Template Status</Text>
      </Box>

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
