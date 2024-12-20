import React from 'react';
import { buildTemplates } from '../rtsql/rtsql';

export default function Apply() {
  React.useEffect(() => {
    async function doApply() {
      await buildTemplates({
        baseDir: process.cwd(),
        skipFiles: true,
        apply: true,
      });
      process.exit(0);
    }
    doApply();
  }, []);
  return null;
}
