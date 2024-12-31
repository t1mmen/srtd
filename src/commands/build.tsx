// commands/build.tsx
import { useApp } from 'ink';
import { option } from 'pastel';
import React from 'react';
import zod from 'zod';
import { TemplateManager } from '../lib/templateManager.js';

export const options = zod.object({
  force: zod.boolean().describe(
    option({
      description: 'Force building of all templates, irrespective of changes',
      alias: 'f',
    })
  ),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Build({ options }: Props) {
  const { exit } = useApp();
  React.useEffect(() => {
    async function doBuild() {
      const manager = await TemplateManager.create(process.cwd());
      await manager.processTemplates({ generateFiles: true, force: options.force });
      exit();
    }
    doBuild();
  }, [options, exit]);

  return null;
}
