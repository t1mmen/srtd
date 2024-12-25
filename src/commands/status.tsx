import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { loadLocalBuildLog } from '../utils/loadLocalBuildLog';
import { loadBuildLog } from '../utils/loadBuildLog';
import { getTimeAgo } from '../utils/getTimeAgo';
import { loadTemplates } from '../utils/loadTemplates';
import { TemplateStatus } from '../types';
import { calculateTemplateState } from '../utils/templateState';
import { StatusIndicator } from '../components/StatusIndicator';

export default function Status() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<TemplateStatus[]>([]);

  React.useEffect(() => {
    async function fetchStatus() {
      try {
        const dirname = process.cwd();
        const templates = await loadTemplates(dirname);
        const buildLog = await loadBuildLog(dirname);
        const localBuildLog = await loadLocalBuildLog(dirname);

        const combined: TemplateStatus[] = templates.map(t => {
          const relPath = path.relative(dirname, t.path);
          const buildState = {
            ...buildLog.templates[relPath],
            ...localBuildLog.templates[relPath],
          };

          return {
            name: t.name,
            path: relPath,
            // status: t.status,
            currentHash: t.currentHash,
            migrationHash: t.migrationHash,
            buildState,
          };
        });

        setItems(combined);
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

      {items.map(item => {
        const state = calculateTemplateState(item);

        return (
          <Box key={item.path} flexDirection="column">
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
