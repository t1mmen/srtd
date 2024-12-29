// commands/watch.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { watch } from 'fs';
import path from 'path';
import { getConfig } from '../utils/config.js';
import { TemplateManager } from '../lib/templateManager.js';

export default function Watch() {
  const [status, setStatus] = React.useState<string>('Initializing...');
  const [error, setError] = React.useState<string | null>(null);
  const [lastBuild, setLastBuild] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    let watcher: ReturnType<typeof watch>;

    const handleExit = () => {
      setStatus('Shutting down...');
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watcher) watcher.close();
      process.exit(0);
    };

    process.on('SIGINT', handleExit);

    async function init() {
      try {
        const baseDir = process.cwd();
        const config = await getConfig(baseDir);
        const manager = await TemplateManager.create(baseDir);
        const templatePath = path.join(baseDir, config.templateDir);

        setStatus('Checking for unapplied templates...');
        const initialResult = await manager.processTemplates({ apply: true });
        if (initialResult.errors.length > 0) {
          setError(initialResult.errors.map(e => `${e.file}: ${e.error}`).join('\n'));
        }
        setStatus('Watching for changes...');

        const handleChange = async (_: string, filename: string | null) => {
          if (!filename?.endsWith('.sql')) return;

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            try {
              setStatus(`Building ${filename}...`);
              const result = await manager.processTemplates({
                filter: filename,
                apply: true,
              });

              if (result.errors.length > 0) {
                setError(result.errors.map(e => `${e.file}: ${e.error}`).join('\n'));
              } else {
                setError(null);
                if (result.applied.length > 0) {
                  setLastBuild(new Date());
                }
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
              setStatus('Watching for changes...');
            }
          }, 100);
        };

        watcher = watch(templatePath, { recursive: true }, handleChange);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('Watch failed');
      }
    }

    init();

    return () => {
      process.off('SIGINT', handleExit);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watcher) watcher.close();
    };
  }, []);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={error ? 'red' : 'white'}>{status}</Text>
      </Box>
      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
      {lastBuild && (
        <Box>
          <Text dimColor>Last build: {lastBuild.toLocaleTimeString()}</Text>
        </Box>
      )}
    </Box>
  );
}
