import React from 'react';
import { buildTemplates } from '../lib/buildTemplates.js';

export default function Build() {
  React.useEffect(() => {
    async function doBuild() {
      await buildTemplates({});
    }
    doBuild();
  }, []);

  return null;
}
