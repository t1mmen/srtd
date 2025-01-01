// src/components/watch.tsx
import path from 'node:path';
import { Badge } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import React, { useMemo } from 'react';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import { TimeSince } from '../components/TimeSince.js';
import { useDatabaseConnection } from '../hooks/useDatabaseConnection.js';
import { useTemplateManager } from '../hooks/useTemplateManager.js';
import type { TemplateUpdate } from '../hooks/useTemplateManager.js';
import type { TemplateStatus } from '../types.js';

const MAX_FILES = 10;
const MAX_CHANGES = 15;
const PATH_DISPLAY_LENGTH = 15;

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box marginRight={1}>
      <Badge color={color}>
        {' '}
        {label}: {value}{' '}
      </Badge>
    </Box>
  );
}

function formatTemplateDisplay(templatePath: string, templateDir: string): string {
  const parts = templatePath.split(path.sep);
  const filename = parts.pop() || '';
  const dirPath = parts.join(path.sep);

  if (dirPath && templateDir && dirPath.includes(templateDir)) {
    const relativePath = dirPath.substring(dirPath.indexOf(templateDir) + templateDir.length + 1);
    if (relativePath) {
      const truncatedPath = relativePath.slice(-PATH_DISPLAY_LENGTH);
      return `${truncatedPath}/${filename}`;
    }
  }
  return filename;
}

const TemplateRow = React.memo(
  ({
    template,
    isLatest,
    templateDir,
  }: {
    template: TemplateStatus;
    isLatest: boolean;
    templateDir?: string;
  }) => {
    const displayName = formatTemplateDisplay(template.path, templateDir ?? '');

    return (
      <Box marginLeft={2}>
        <Box width={2}>
          <Text>{template.buildState.lastAppliedError ? '❌' : isLatest ? '⚡️' : '✓'}</Text>
        </Box>
        <Box width={35}>
          <Text>{displayName}</Text>
        </Box>
        <Box>
          <Text dimColor>
            applied <TimeSince date={template.buildState.lastAppliedDate} /> ago
            {!template.buildState.lastBuildDate ||
            template.currentHash !== template.buildState.lastBuildHash ? (
              <> • needs build</>
            ) : (
              <>
                {' '}
                • built <TimeSince date={template.buildState.lastBuildDate} /> ago
              </>
            )}
          </Text>
        </Box>
      </Box>
    );
  }
);

TemplateRow.displayName = 'TemplateRow';

const UpdateLog = React.memo(
  ({
    updates,
    templateDir,
  }: {
    updates: TemplateUpdate[];
    templateDir?: string;
  }) => {
    const sortedUpdates = useMemo(() => {
      return [...updates]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(0, MAX_CHANGES);
    }, [updates]);

    const formatError = (error: unknown) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (typeof error === 'object' && error && 'error' in error) {
        return String(error.error);
      }
      return String(error);
    };

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Changelog:</Text>
        {sortedUpdates.map(update => (
          <Box key={`${update.template.path}-${update.timestamp}`} marginLeft={2}>
            <Text
              color={update.type === 'error' ? 'red' : update.type === 'applied' ? 'green' : 'blue'}
            >
              {update.type === 'error' ? '❌' : update.type === 'applied' ? '✨' : '📝'}{' '}
              {formatTemplateDisplay(update.template.path, templateDir ?? '')}:{' '}
              {update.type === 'error'
                ? formatError(update.error)
                : update.type === 'applied'
                  ? 'applied successfully'
                  : 'changed and reapplied'}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }
);

UpdateLog.displayName = 'UpdateLog';

export default function Watch() {
  const { isConnected } = useDatabaseConnection();
  const { templates, updates, stats, isLoading, errors, latestPath, templateDir } =
    useTemplateManager();
  const [showUpdates, setShowUpdates] = React.useState(true);
  const activeTemplates = useMemo(() => templates.slice(-MAX_FILES), [templates]);
  const hasErrors = errors.size > 0;

  useInput(input => {
    if (input === 'u') {
      setShowUpdates(s => !s);
    }
  });

  if (!isConnected) {
    return (
      <Box flexDirection="column">
        <Text color="red">Unable to connect to database. Is Supabase running?</Text>
        <Quittable />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Branding subtitle="👀 Watch Mode" />

      <Box marginY={1}>
        <StatBadge label="Total" value={stats.total} color="green" />
        {stats.needsBuild > 0 && (
          <StatBadge label="Needs Build" value={stats.needsBuild} color="yellow" />
        )}
        {stats.recentlyChanged > 0 && (
          <StatBadge label="Recent Changes" value={stats.recentlyChanged} color="blue" />
        )}
        {hasErrors && <StatBadge label="Errors" value={stats.errors} color="red" />}
      </Box>

      {isLoading ? (
        <Text>🔍 Finding templates...</Text>
      ) : (
        <Box flexDirection="column">
          {activeTemplates.map(template => (
            <TemplateRow
              key={template.path}
              template={template}
              isLatest={template.path === latestPath}
              templateDir={templateDir}
            />
          ))}

          {showUpdates && updates.length > 0 && (
            <UpdateLog updates={updates} templateDir={templateDir} />
          )}

          {hasErrors && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="red">
                Errors:
              </Text>
              {Array.from(errors.entries()).map(([path, error]) => (
                <Box key={path} marginLeft={2} marginTop={1}>
                  <Text color="red" wrap="wrap">
                    {formatTemplateDisplay(path, templateDir ?? '')}: {String(error)}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      <Box marginY={1} flexDirection="row" gap={1}>
        <Quittable />
        {updates.length > 0 && (
          <>
            <Box marginY={1}>
              <Text dimColor>•</Text>
            </Box>
            <Box marginY={1}>
              <Text dimColor>press </Text>
              <Text underline={showUpdates}>u</Text>
              <Text dimColor> to toggle updates</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
