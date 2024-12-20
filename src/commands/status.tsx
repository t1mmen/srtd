import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { loadTemplates, loadBuildLog, loadLocalBuildLog } from '../rtsql/rtsql.utils';

interface TemplateStatus {
  name: string;
  path: string;
  status: 'unregistered' | 'registered' | 'modified';
  buildInfo: {
    lastHash?: string;
    lastBuilt?: string;
    lastMigration?: string;
  };
  applyInfo: {
    lastApplied?: string;
  };
}

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
          const logEntry = buildLog.templates[relPath] || {};
          const localEntry = localBuildLog.templates[relPath] || {};

          return {
            name: t.name,
            path: relPath,
            status: t.status,
            buildInfo: {
              lastHash: logEntry.lastHash,
              lastBuilt: logEntry.lastBuilt,
              lastMigration: logEntry.lastMigration,
            },
            applyInfo: {
              lastApplied: localEntry.lastApplied,
            },
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
    const d = new Date(date);
    return d.toLocaleString();
  };

  const getAgeIndicator = (item: TemplateStatus) => {
    if (!item.buildInfo.lastBuilt) return '⚠️ Never built';
    if (!item.applyInfo.lastApplied) return '⚠️ Never applied';

    const buildDate = new Date(item.buildInfo.lastBuilt);
    const applyDate = new Date(item.applyInfo.lastApplied || 0);

    if (buildDate > applyDate) return '⚠️ Out of sync';
    return '✓ In sync';
  };

  if (loading || error) {
    if (loading) {
      return <Text>Loading status…</Text>;
    }
    if (error) {
      return <Text color="red">Error: {error}</Text>;
    }
  }

  const total = items.length;
  const unregisteredCount = items.filter(i => i.status === 'unregistered').length;
  const registeredCount = items.filter(i => i.status === 'registered').length;
  const modifiedCount = items.filter(i => i.status === 'modified').length;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Templates Status Summary</Text>
      </Box>
      <Box>
        <Text>Total: {total} | </Text>
        <Text color="green">✓ {registeredCount} | </Text>
        <Text color="yellow">⚒️ {modifiedCount} | </Text>
        <Text color="red">⨯ {unregisteredCount}</Text>
      </Box>

      {/* Enhanced Table Header */}
      <Box marginY={1}>
        <Box width={2}>
          <Text> </Text>
        </Box>
        <Box width={25}>
          <Text bold>Template</Text>
        </Box>
        <Box width={20}>
          <Text bold>Last Built</Text>
        </Box>
        <Box width={20}>
          <Text bold>Last Applied</Text>
        </Box>
        <Box width={15}>
          <Text bold>Status</Text>
        </Box>
      </Box>

      {/* Enhanced Table Content */}
      <Box flexDirection="column">
        {items.map(item => {
          const statusEmoji =
            item.status === 'registered' ? '✓' : item.status === 'modified' ? '⚒️' : '⨯';
          const statusColor =
            item.status === 'registered' ? 'green' : item.status === 'modified' ? 'yellow' : 'red';

          return (
            <Box key={item.path}>
              <Box width={2}>
                <Text color={statusColor}>{statusEmoji}</Text>
              </Box>
              <Box width={25}>
                <Text>{item.name}</Text>
              </Box>
              <Box width={20}>
                <Text dimColor>{formatDate(item.buildInfo.lastBuilt)}</Text>
              </Box>
              <Box width={20}>
                <Text dimColor>{formatDate(item.applyInfo.lastApplied)}</Text>
              </Box>
              <Box width={15}>
                <Text>{getAgeIndicator(item)}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
