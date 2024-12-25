import React from 'react';
import { Box, Text } from 'ink';
import fs from 'fs';
import path from 'path';
import { buildTemplates } from '../lib/buildTemplates';
import { getConfig } from '../utils/config';

export default function Watch() {
  const [status, setStatus] = React.useState<string>('Initializing...');
  const [error, setError] = React.useState<string | null>(null);
  const [lastBuild, setLastBuild] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    let watcher: fs.FSWatcher;

    // Add SIGINT handler
    const handleExit = () => {
      setStatus('Shutting down...');
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watcher) watcher.close();
      process.exit(0);
    };

    process.on('SIGINT', handleExit);

    async function init(): Promise<void> {
      try {
        const baseDir = process.cwd();
        const config = await getConfig(baseDir);
        const templatePath = path.join(baseDir, config.templateDir);

        if (!fs.existsSync(templatePath)) {
          throw new Error('Template directory not found. Run init first.');
        }

        const handleChange = async (_: string, filename: string | null) => {
          if (!filename?.endsWith('.sql')) return;

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            try {
              setStatus(`Building ${filename}...`);
              const result = await buildTemplates({
                baseDir,
                filter: filename,
                apply: true,
                skipFiles: true,
                verbose: false,
              });

              if (result.errors.length > 0) {
                setError(result.errors[0].error);
              } else {
                setError(null);
                setLastBuild(new Date());
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
              setStatus('Watching for changes...');
            }
          }, 100);
        };

        watcher = fs.watch(templatePath, { recursive: true } as fs.WatchOptions, handleChange);
        setStatus('Watching for changes...');
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
