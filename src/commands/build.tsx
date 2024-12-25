import React from 'react';
import { buildTemplates } from '../utils/buildTemplates';

export default function Build() {
  React.useEffect(() => {
    async function doBuild() {
      await buildTemplates({});
    }
    doBuild();
  }, []);

  return null;
}
