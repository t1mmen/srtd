import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { loadTemplates, loadBuildLog, loadLocalBuildLog, getTimeAgo } from '../rtsql/rtsql.utils';
import {
  TemplateStatus,
  TemplateStateInfo,
  BuildStatus,
  ApplyStatus,
  TemplateState,
} from '../rtsql/rtsql.types';

const calculateTemplateState = (template: TemplateStatus): TemplateStateInfo => {
  const { currentHash, buildState, path } = template;
  const isWip = path.endsWith('.wip.sql');

  // Build status tracks migration generation
  let buildStatus = BuildStatus.NOT_BUILT;
  let buildMessage;

  if (buildState.lastBuildError) {
    buildStatus = BuildStatus.ERROR;
    buildMessage = buildState.lastBuildError;
  } else if (!buildState.lastBuildHash) {
    buildStatus = BuildStatus.NOT_BUILT;
  } else if (buildState.lastBuildHash === currentHash) {
    buildStatus = BuildStatus.BUILT;
  } else {
    buildStatus = BuildStatus.MODIFIED;
    buildMessage = 'Template changed since last build';
  }

  // Apply status tracks database state
  let applyStatus = ApplyStatus.NOT_APPLIED;
  let applyMessage;

  if (buildState.lastAppliedError) {
    applyStatus = ApplyStatus.ERROR;
    applyMessage = buildState.lastAppliedError;
  } else if (!buildState.lastAppliedHash) {
    applyStatus = ApplyStatus.NOT_APPLIED;
  } else if (buildState.lastAppliedHash === currentHash) {
    applyStatus = ApplyStatus.APPLIED;
  } else {
    applyStatus = ApplyStatus.PENDING;
    applyMessage = 'Changes not applied to database';
  }

  // Final template state
  let state = TemplateState.UNREGISTERED;

  if (isWip) {
    state = TemplateState.WIP;
  } else if (applyStatus === ApplyStatus.APPLIED) {
    state = TemplateState.REGISTERED;
  } else if (buildStatus === BuildStatus.MODIFIED || applyStatus === ApplyStatus.PENDING) {
    state = TemplateState.MODIFIED;
  }

  return {
    state,
    buildStatus,
    applyStatus,
    currentHash,
    buildMessage,
    applyMessage,
  };
};

const getStatusIndicator = (state: TemplateStateInfo) => {
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
};

const getBuildStatusColor = (status: BuildStatus): string => {
  switch (status) {
    case BuildStatus.BUILT:
      return 'green';
    case BuildStatus.MODIFIED:
      return 'yellow';
    case BuildStatus.ERROR:
      return 'red';
    default:
      return 'gray'; // NOT_BUILT
  }
};

const getApplyStatusColor = (status: ApplyStatus): string => {
  switch (status) {
    case ApplyStatus.APPLIED:
      return 'green';
    case ApplyStatus.PENDING:
      return 'yellow';
    case ApplyStatus.ERROR:
      return 'red';
    default:
      return 'gray'; // NOT_APPLIED
  }
};

const getBuildStatusIcon = (status: BuildStatus) => {
  switch (status) {
    case BuildStatus.BUILT:
      return '✓ Built';
    case BuildStatus.MODIFIED:
      return '⚠️ Modified';
    case BuildStatus.ERROR:
      return '❌ Failed';
    default:
      return '- Not Built';
  }
};

const getApplyStatusIcon = (status: ApplyStatus) => {
  switch (status) {
    case ApplyStatus.APPLIED:
      return '✓ Applied';
    case ApplyStatus.PENDING:
      return '⚠️ Pending';
    case ApplyStatus.ERROR:
      return '❌ Failed';
    default:
      return '- Not Applied';
  }
};

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
              {getStatusIndicator(state)}
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
