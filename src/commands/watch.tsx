import path from 'node:path';
import { Badge } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React from 'react';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import { TimeSince } from '../components/TimeSince.js';
import { useDatabaseConnection } from '../hooks/useDatabaseConnection.js';
import { TemplateManager } from '../lib/templateManager.js';
import type { TemplateStatus } from '../types.js';

export default function Watch() {
  const [templates, setTemplates] = React.useState<TemplateStatus[]>([]);
  const [error, setError] = React.useState<string>();
  const managerRef = React.useRef<TemplateManager>();
  const mounted = React.useRef(true);
  const { isConnected } = useDatabaseConnection();

  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    // console.clear();

    async function init(): Promise<() => void> {
      try {
        managerRef.current = await TemplateManager.create(process.cwd(), { silent: true });

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

    init().then(c => {
      cleanup = c;
    });
    return () => cleanup?.();
  }, []);

  const handleQuit = () => {
    if (mounted.current) mounted.current = false;
  };

  if (error) {
    return (
      <>
        <Text color="red">Error: {error}</Text>
        <Quittable onQuit={handleQuit} />
      </>
    );
  }

  const templatesByDir = templates.reduce(
    (acc, template) => {
      const dir = path.dirname(path.relative(process.cwd(), template.path));
      if (!acc[dir]) {
        acc[dir] = [];
      }
      acc[dir].push(template);
      return acc;
    },
    {} as Record<string, TemplateStatus[]>
  );

  const hasErrors = templates.some(t => t.buildState.lastAppliedError);

  return (
    <Box flexDirection="column" marginBottom={2}>
      <Branding subtitle="👀 Watch Mode" />

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
                      ? '⚡️'
                      : '✓'}
                </Text>
              </Box>
              <Box width={20}>
                <Text>{path.basename(template.path)}</Text>
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
          <Quittable onQuit={handleQuit} />
        </Box>
      )}

      {!isConnected ? (
        <Box marginTop={1}>
          <Badge color="red"> ERROR </Badge>
          <Text> Database not reachable </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Badge color={hasErrors ? 'red' : '#3ecf8e'}>{hasErrors ? ' FAIL ' : ' OK '}</Badge>
          <Text dimColor>Watching for template changes...</Text>
        </Box>
      )}

      <Quittable onQuit={handleQuit} />
    </Box>
  );
}
