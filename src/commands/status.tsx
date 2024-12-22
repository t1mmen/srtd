import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { loadTemplates, loadBuildLog, loadLocalBuildLog, getTimeAgo } from '../rtsql/rtsql.utils';
import { TemplateStatus } from '../rtsql/rtsql.types';

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

        const combined = templates.map(t => {
          const relPath = path.relative(dirname, t.path);
          const buildState = {
            ...buildLog.templates[relPath],
            ...localBuildLog.templates[relPath],
          };

          return {
            name: t.name,
            path: relPath,
            status: t.status,
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

  const getStatusIndicator = (item: TemplateStatus) => {
    const { buildState } = item;

    if (buildState.lastBuildError) return '❌ Build failed';
    if (buildState.lastAppliedError) return '❌ Apply failed';
    if (!buildState.lastBuildDate) return '⚠️ Not built';
    if (!buildState.lastAppliedDate) return '⚠️ Not applied';

    if (buildState.lastBuildHash !== buildState.lastAppliedHash) {
      return '⚠️ Out of sync';
    }

    return '✓ In sync';
  };

  if (loading) return <Text>Loading status…</Text>;
  if (error) return <Text color="red">Error: {error}</Text>;

  const total = items.length;
  const unregisteredCount = items.filter(i => i.status === 'unregistered').length;
  const registeredCount = items.filter(i => i.status === 'registered').length;
  const modifiedCount = items.filter(i => i.status === 'modified').length;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Template Status</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Total: {total} | </Text>
        <Text color="green">✓ {registeredCount} | </Text>
        <Text color="yellow">⚒️ {modifiedCount} | </Text>
        <Text color="red">⨯ {unregisteredCount}</Text>
      </Box>

      <Box marginY={1}>
        <Box width={25}>
          <Text bold>Template</Text>
        </Box>
        <Box width={15}>
          <Text bold>Built</Text>
        </Box>
        <Box width={15}>
          <Text bold>Applied</Text>
        </Box>
        <Box width={20}>
          <Text bold>Status</Text>
        </Box>
      </Box>

      {items.map(item => {
        const statusColor =
          item.buildState.lastBuildError || item.buildState.lastAppliedError
            ? 'red'
            : item.status === 'registered'
              ? 'green'
              : item.status === 'modified'
                ? 'yellow'
                : 'red';

        return (
          <Box key={item.path} flexDirection="column">
            <Box>
              <Box width={25}>
                <Text>{item.name}</Text>
              </Box>
              <Box width={15}>
                <Text dimColor>{formatDate(item.buildState.lastBuildDate)}</Text>
              </Box>
              <Box width={15}>
                <Text dimColor>{formatDate(item.buildState.lastAppliedDate)}</Text>
              </Box>
              <Box width={20}>
                <Text color={statusColor}>{getStatusIndicator(item)}</Text>
              </Box>
            </Box>
            {(item.buildState.lastBuildError || item.buildState.lastAppliedError) && (
              <Box marginLeft={2} marginBottom={1}>
                <Text color="red">
                  {item.buildState.lastBuildError || item.buildState.lastAppliedError}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
