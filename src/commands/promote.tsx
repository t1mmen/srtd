import fs from 'node:fs/promises';
import path from 'node:path';
import { Select, Spinner } from '@inkjs/ui';
import figures from 'figures';
import { glob } from 'glob';
import { Box, Text, useApp } from 'ink';
import { argument } from 'pastel';
import React, { useCallback, useEffect, useState } from 'react';
import zod from 'zod';
import Branding from '../components/Branding.js';
import Quittable from '../components/Quittable.js';
import { COLOR_ERROR, COLOR_SUCCESS, COLOR_WARNING } from '../components/customTheme.js';
import type { CLIConfig } from '../types.js';
import { getConfig } from '../utils/config.js';
import { loadBuildLog } from '../utils/loadBuildLog.js';
import { saveBuildLog } from '../utils/saveBuildLog.js';

export const args = zod
  .array(zod.string())
  .optional()
  .describe(
    argument({
      name: 'templates',
      description: 'Template files to promote (optional)',
    })
  );

interface Props {
  args?: zod.infer<typeof args>;
}

export default function Promote({ args: templateArgs }: Props) {
  const { exit } = useApp();
  const [templates, setTemplates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState<CLIConfig | null>(null);

  const findWipTemplates = useCallback(async () => {
    try {
      const config = await getConfig(process.cwd());
      setConfig(config);
      const templatePath = path.join(process.cwd(), config.templateDir);
      const pattern = `**/*${config.wipIndicator}*.sql`;
      const matches = await glob(pattern, { cwd: templatePath });
      const fullPaths = matches.map(m => path.join(templatePath, m));
      setTemplates(fullPaths);
      return fullPaths;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to find WIP templates: ${msg}`);
      return [];
    }
  }, []);

  const promoteTemplate = useCallback(
    async (templatePath: string) => {
      try {
        const config = await getConfig(process.cwd());
        const newPath = templatePath.replace(config.wipIndicator, '');

        // Load build log before file operations
        const buildLog = await loadBuildLog(process.cwd(), 'local');
        const relOldPath = path.relative(process.cwd(), templatePath);
        const relNewPath = path.relative(process.cwd(), newPath);

        // Check if source file exists
        await fs.access(templatePath);

        // Rename the file
        await fs.rename(templatePath, newPath);

        // Update build logs if template was tracked
        if (buildLog.templates[relOldPath]) {
          buildLog.templates[relNewPath] = buildLog.templates[relOldPath];
          delete buildLog.templates[relOldPath];
          await saveBuildLog(process.cwd(), buildLog, 'local');
        }

        const templateName = path.basename(newPath, '.sql');
        setSuccess(`Successfully promoted ${templateName}`);

        // Exit after short delay
        setTimeout(() => exit(), 0);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to promote template: ${msg}`);
      }
    },
    [exit]
  );

  useEffect(() => {
    const init = async () => {
      const config = await getConfig(process.cwd());
      await findWipTemplates();

      if (templateArgs?.length) {
        // Handle CLI mode
        const templateName = templateArgs[0];
        const templateDir = path.join(process.cwd(), config.templateDir);
        const pattern = `**/*${templateName}*`;
        const matches = await glob(pattern, { cwd: templateDir });
        const isWip = config.wipIndicator && templateName?.includes(config.wipIndicator);
        if (matches.length === 0 || !isWip) {
          setError(`No WIP template found matching: ${templateName} in ${config.templateDir}`);
          exit();
        }

        if (!isWip) {
          setError(`Template is not a WIP template: ${templateName}`);
          exit();
        }

        const match = matches[0] ? path.join(templateDir, matches[0]) : '';
        if (!match) {
          setError(`No valid match found for template: ${templateName} in ${config.templateDir}`);
          exit();
        }
        await promoteTemplate(match);
      }
    };

    init();
  }, [templateArgs, findWipTemplates, promoteTemplate, exit]);

  // UI status displays
  if (error) {
    return (
      <Box flexDirection="column">
        <Branding subtitle="🚀 Promote WIP template" />
        <Text color={COLOR_ERROR}>
          {figures.cross} {error}
        </Text>
      </Box>
    );
  }

  if (success) {
    return (
      <Box flexDirection="column">
        <Branding subtitle="🚀 Promote WIP template" />
        <Box gap={1} flexDirection="column">
          <Text color={COLOR_SUCCESS}>
            {figures.tick} {success}
          </Text>
          <Text dimColor>Run `build` command to generate migrations</Text>
        </Box>
      </Box>
    );
  }

  // Interactive UI mode
  if (!templateArgs?.length) {
    if (templates.length === 0) {
      return (
        <Box flexDirection="column">
          <Branding subtitle="🚀 Promote WIP template" />
          <Text color={COLOR_WARNING}>
            {figures.warning} No WIP templates found in {config?.templateDir}{' '}
            <Text bold>({config?.wipIndicator})</Text>
          </Text>
          <Quittable />
        </Box>
      );
    }

    const menuItems = templates.map(t => ({
      label: path.basename(t),
      value: t,
    }));

    return (
      <Box flexDirection="column">
        <Branding subtitle="🚀 Promote WIP template" />
        <Box gap={1} marginBottom={1}>
          <Text>Select a template to promote</Text>
          <Text dimColor>(removes {config?.wipIndicator} in filename)</Text>
        </Box>
        <Box gap={1} flexDirection="column">
          <Select visibleOptionCount={30} options={menuItems} onChange={promoteTemplate} />
        </Box>
        <Quittable />
      </Box>
    );
  }

  // Loading state for CLI mode
  return (
    <Box flexDirection="column">
      <Branding subtitle="🚀 Promote WIP template" />
      <Spinner label="Loading..." />
    </Box>
  );
}
