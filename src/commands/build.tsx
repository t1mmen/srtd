// commands/build.tsx
import React from 'react';
import { TemplateManager } from '../lib/templateManager.js';

export default function Build() {
  React.useEffect(() => {
    async function doBuild() {
      const manager = await TemplateManager.create(process.cwd());
      await manager.processTemplates({ generateFiles: true });
      process.exit(0);
    }
    doBuild();
  }, []);

  return null;
}
