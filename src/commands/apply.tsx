import React from 'react';
import { buildTemplates } from '../utils/buildTemplates';

export default function Apply() {
  React.useEffect(() => {
    async function doApply() {
      await buildTemplates({
        skipFiles: true,
        apply: true,
      });
      process.exit(0);
    }
    doApply();
  }, []);
  return null;
}
