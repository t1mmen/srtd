// commands/watch.tsx
import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import * as chokidar from 'chokidar';
import path from 'path';
import { TemplateManager } from '../lib/templateManager.js';
import { TemplateStatus } from '../types.js';
import { getConfig } from '../utils/config.js';

interface FileChange {
  filename: string;
  relativePath: string;
  status: 'success' | 'error' | 'pending';
  error?: string;
  timestamp: Date;
  buildHash?: string;
  currentHash?: string;
  lastApplied?: Date;
  lastBuilt?: Date;
}

const TimeSince = ({ date }: { date?: Date }) => {
  const [, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!date) return <Text>never</Text>;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return <Text>{seconds}s</Text>;
  if (seconds < 3600) return <Text>{Math.floor(seconds / 60)}m</Text>;
  if (seconds < 86400) return <Text>{Math.floor(seconds / 3600)}h</Text>;
  return <Text>{Math.floor(seconds / 86400)}d</Text>;
};

export default function Watch() {
  const { exit } = useApp();
  const [changes, setChanges] = React.useState<FileChange[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string>();
  const managerRef = React.useRef<TemplateManager>();
  const config = React.useRef<Awaited<ReturnType<typeof getConfig>>>();

  useInput((input, key) => {
    if (input.toLowerCase() === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
  });

  const updateStatus = React.useCallback(async (template: TemplateStatus) => {
    const change: FileChange = {
      filename: path.basename(template.path),
      relativePath: path.relative(process.cwd(), template.path),
      status: template.buildState.lastAppliedError ? 'error' : 'success',
      error: template.buildState.lastAppliedError,
      timestamp: new Date(),
      currentHash: template.currentHash,
      buildHash: template.buildState.lastBuildHash,
      lastApplied: template.buildState.lastAppliedDate
        ? new Date(template.buildState.lastAppliedDate)
        : undefined,
      lastBuilt: template.buildState.lastBuildDate
        ? new Date(template.buildState.lastBuildDate)
        : undefined,
    };

    setChanges(prev => {
      const filtered = prev.filter(f => f.filename !== change.filename);
      return [...filtered, change];
    });

    if (change.error) {
      setErrors(prev => ({ ...prev, [change.filename]: change.error! }));
    } else {
      setErrors(prev => {
        const { [change.filename]: _, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let watcher: chokidar.FSWatcher | undefined;

    const cleanup = () => {
      mounted = false;
      if (watcher) {
        watcher.close();
        watcher = undefined;
      }
    };

    async function processChange(filepath: string) {
      if (!mounted || !managerRef.current) return;
      console.log('Processing change:', filepath);
      const result = await managerRef.current.processTemplates({
        apply: true,
        filter: filepath,
      });

      if (result.applied.length > 0) {
        setErrors(prev => {
          const { [path.basename(filepath)]: _, ...rest } = prev;
          return rest;
        });
      }

      const updatedTemplate = await managerRef.current.getTemplateStatus(filepath);
      await updateStatus(updatedTemplate);
    }

    async function initWatch() {
      if (!mounted) return;

      try {
        process.stdout.write('\x1b[2J');
        process.stdout.write('\x1b[0f');

        config.current = await getConfig();
        managerRef.current = await TemplateManager.create(process.cwd());
        const templates = await managerRef.current.findTemplates();

        // Initial status
        for (const templatePath of templates) {
          const template = await managerRef.current.getTemplateStatus(templatePath);
          await updateStatus(template);
        }

        // Watch for changes
        const templateDir = path.join(process.cwd(), config.current.templateDir);
        watcher = chokidar.watch(templateDir, {
          ignoreInitial: true,
          depth: 0,
        });

        watcher.on('change', async (filepath: string) => {
          if (path.extname(filepath) === '.sql') {
            await processChange(filepath);
          }
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void initWatch();
    return cleanup;
  }, [updateStatus]);

  const getStatusIcon = (change: FileChange) => {
    return change.error ? '❌' : '✓';
  };

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  const templatesByDir = changes.reduce(
    (acc, change) => {
      const dir = path.dirname(change.relativePath);
      (acc[dir] = acc[dir] || []).push(change);
      return acc;
    },
    {} as Record<string, FileChange[]>
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>srtd - Watch Mode</Text>
      </Box>

      {Object.entries(templatesByDir).map(([dir, dirChanges]) => (
        <Box key={dir} flexDirection="column" marginLeft={1}>
          <Text dimColor>{dir}</Text>
          {dirChanges.map(change => (
            <Box key={change.filename} marginLeft={2}>
              <Box width={2}>
                <Text>{getStatusIcon(change)}</Text>
              </Box>
              <Box width={20}>
                <Text>{change.filename}</Text>
              </Box>
              <Box>
                <Text dimColor>
                  applied <TimeSince date={change.lastApplied} /> ago
                  {change.currentHash !== change.buildHash
                    ? ' • needs build'
                    : ` • built ${change.lastBuilt ? <TimeSince date={change.lastBuilt} /> : 'never'} ago`}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      ))}

      {Object.keys(errors).length > 0 && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color="red">
            Errors
          </Text>
          {Object.entries(errors).map(([filename, error]) => (
            <Box key={filename} marginLeft={2}>
              <Text color="red">
                • {filename}: {error}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginY={1}>
        {Object.keys(errors).length > 0 ? (
          <Text bold color="red">
            FAIL
          </Text>
        ) : (
          <Text bold color="green">
            PASS
          </Text>
        )}
        <Text> </Text>
        <Text dimColor>Waiting for file changes...</Text>
      </Box>

      <Box>
        <Text dimColor>press </Text>
        <Text>q</Text>
        <Text dimColor> or </Text>
        <Text>Ctrl+c</Text>
        <Text dimColor> to quit</Text>
      </Box>
    </Box>
  );
}
