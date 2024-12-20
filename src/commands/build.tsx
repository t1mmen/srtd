import React from 'react';
import { buildTemplates } from '../rtsql/rtsql';

export default function Build() {
  React.useEffect(() => {
    async function doBuild() {
      await buildTemplates({});
    }
    doBuild();
  }, []);

  return null;
}
