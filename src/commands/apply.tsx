import React from 'react';
import { TemplateManager } from '../lib/templateManager.js';

export default function Apply() {
  React.useEffect(() => {
    async function doApply() {
      try {
        const manager = await TemplateManager.create(process.cwd());
        await manager.processTemplates({ apply: true });
        process.exit(0);
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }
    void doApply();
  }, []);
  return null;
}
