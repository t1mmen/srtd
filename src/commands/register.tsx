import React from 'react';
import { Text, Box, useInput } from 'ink';
import zod from 'zod';
import glob from 'glob';
import path from 'path';
import {
  TEMPLATE_DIR,
  loadBuildLog,
  loadLocalBuildLog,
  registerTemplate,
  calculateMD5,
} from '../rtsql/rtsql.utils';

type TemplateStatus = 'unregistered' | 'registered' | 'modified';

interface Template {
  name: string;
  path: string;
  status: TemplateStatus;
  selected?: boolean;
}

export const options = zod.object({
  verbose: zod.boolean().default(false).describe('Show detailed output'),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Register({ options }: Props) {
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [registering, setRegistering] = React.useState(false);

  React.useEffect(() => {
    loadTemplates();
  }, []);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(templates.length - 1, selectedIndex + 1));
    }
    if (input === ' ') {
      toggleTemplate(selectedIndex);
    }
    if (key.return) {
      registerSelectedTemplates();
    }
  });

  async function loadTemplates() {
    const files = await glob(path.join(TEMPLATE_DIR, '*.sql'));
    const buildLog = await loadBuildLog(process.cwd());
    const localBuildLog = await loadLocalBuildLog(process.cwd());

    const templateList = await Promise.all(
      files.map(async file => {
        const name = path.basename(file);
        const content = await fs.readFile(file, 'utf-8');
        const hash = await calculateMD5(content);
        const logEntry = buildLog.templates[file];
        const localEntry = localBuildLog.templates[file];

        let status: TemplateStatus = 'unregistered';
        if (logEntry && localEntry) {
          status = logEntry.lastHash === hash ? 'registered' : 'modified';
        }

        return { name, path: file, status };
      })
    );

    setTemplates(templateList);
  }

  function toggleTemplate(index: number) {
    setTemplates(
      templates.map((t, i) => ({
        ...t,
        selected: i === index ? !t.selected : t.selected,
      }))
    );
  }

  async function registerSelectedTemplates() {
    setRegistering(true);
    for (const template of templates.filter(t => t.selected)) {
      await registerTemplate(template.path, process.cwd());
    }
    await loadTemplates(); // Refresh list
    setRegistering(false);
  }

  return (
    <Box flexDirection="column">
      <Text bold>Register Templates</Text>
      <Text>Space to select, Enter to register, ↑↓ to navigate</Text>
      <Box flexDirection="column" marginTop={1}>
        {templates.map((template, i) => (
          <Text key={template.name}>
            {i === selectedIndex ? '>' : ' '}
            {template.selected ? '[×]' : '[ ]'} {template.name}{' '}
            {template.status === 'registered' && <Text color="green">(registered)</Text>}
            {template.status === 'modified' && <Text color="yellow">(modified)</Text>}
          </Text>
        ))}
      </Box>
      {registering && <Text>Registering selected templates...</Text>}
    </Box>
  );
}
