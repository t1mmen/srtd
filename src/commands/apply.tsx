// commands/build.tsx
import { useApp } from 'ink';
import { option } from 'pastel';
import React from 'react';
import zod from 'zod';
import { TemplateManager } from '../lib/templateManager.js';

export const options = zod.object({
  force: zod.boolean().describe(
    option({
      description: 'Force apply of all templates, irrespective of changes',
      alias: 'f',
    })
  ),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Apply({ options }: Props) {
  const { exit } = useApp();
  React.useEffect(() => {
    async function doApply() {
      try {
        const manager = await TemplateManager.create(process.cwd());
        await manager.processTemplates({ apply: true, force: options.force });
        exit();
      } catch (err) {
        if (err instanceof Error) {
          exit(err);
        }
      }
    }
    void doApply();
  }, [exit, options]);
  return null;
}
