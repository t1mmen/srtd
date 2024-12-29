import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import path from 'path';
import { TemplateManager } from '../lib/templateManager.js';
import type { TemplateStatus } from '../types.js';

export default function Watch() {
  const { exit } = useApp();
  const [templates, setTemplates] = React.useState<TemplateStatus[]>([]);
  const [error, setError] = React.useState<string>();
  const managerRef = React.useRef<TemplateManager>();
  const mounted = React.useRef(true);
  const [now, setNow] = React.useState(new Date());

  useInput((input, key) => {
    if (input.toLowerCase() === 'q' || (key.ctrl && input === 'c')) {
      mounted.current = false;
      setTimeout(() => exit(), 0);
    }
  });

  // Live timestamp updates
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init(): Promise<() => void> {
      try {
        // Clear console once
        process.stdout.write('\x1b[2J');
        process.stdout.write('\x1b[0f');
        process.stdout.write('\n'.repeat(2));

        managerRef.current = await TemplateManager.create(process.cwd());

        // Initial template load
        const initialTemplates = await managerRef.current.findTemplates();
        for (const templatePath of initialTemplates) {
          const status = await managerRef.current.getTemplateStatus(templatePath);
          if (mounted.current) {
            setTemplates(prev => [...prev.filter(t => t.path !== status.path), status]);
          }
        }

        // Watch and handle changes
        const watcher = await managerRef.current.watch();

        // Update UI on template changes
        const updateTemplate = async (template: TemplateStatus) => {
          if (!mounted.current) return;
          const status = await managerRef.current?.getTemplateStatus(template.path);
          if (status) {
            setTemplates(prev => [...prev.filter(t => t.path !== status.path), status]);
          }
        };

        managerRef.current.on('templateChanged', updateTemplate);
        managerRef.current.on('templateApplied', updateTemplate);
        managerRef.current.on('templateError', ({ template }) => updateTemplate(template));

        // Initial apply for any out-of-date templates
        await managerRef.current.processTemplates({ apply: true });

        return () => {
          mounted.current = false;
          watcher.close();
        };
      } catch (err) {
        if (mounted.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return () => {
          mounted.current = false;
        };
      }
    }

    init().then(c => (cleanup = c));
    return () => cleanup?.();
  }, []);

  const formatTimeAgo = (date: string | undefined) => {
    if (!date) return 'never';
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  const templatesByDir = templates.reduce(
    (acc, template) => {
      const dir = path.dirname(path.relative(process.cwd(), template.path));
      (acc[dir] = acc[dir] || []).push(template);
      return acc;
    },
    {} as Record<string, TemplateStatus[]>
  );

  const hasErrors = templates.some(t => t.buildState.lastAppliedError);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>srtd - Watch Mode</Text>
      </Box>

      {Object.entries(templatesByDir).map(([dir, dirTemplates]) => (
        <Box key={dir} flexDirection="column" marginLeft={1}>
          <Text dimColor>{dir}</Text>
          {dirTemplates.map(template => (
            <Box key={template.path} marginLeft={2}>
              <Box width={2}>
                <Text>
                  {template.buildState.lastAppliedError
                    ? '❌'
                    : template === templates[templates.length - 1]
                      ? '✓'
                      : ' '}
                </Text>
              </Box>
              <Box width={20}>
                <Text>{path.basename(template.path)}</Text>
              </Box>
              <Box>
                <Text dimColor>
                  applied {formatTimeAgo(template.buildState.lastAppliedDate)} ago
                  {template.currentHash !== template.buildState.lastBuildHash
                    ? ' • needs build'
                    : ` • built ${formatTimeAgo(template.buildState.lastBuildDate)} ago`}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      ))}

      {hasErrors && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color="red">
            Errors
          </Text>
          {templates
            .filter(t => t.buildState.lastAppliedError)
            .map(t => (
              <Box key={t.name} marginLeft={2}>
                <Text color="red">
                  • {t.name}: {t.buildState.lastAppliedError}
                </Text>
              </Box>
            ))}
        </Box>
      )}

      <Box marginY={1}>
        <Text bold color={hasErrors ? 'red' : 'green'}>
          {hasErrors ? 'FAIL' : 'PASS'}
        </Text>
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
