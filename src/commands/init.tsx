import React from 'react';
import { saveConfig } from '../rtsql/config';

export default function Init() {
  React.useEffect(() => {
    async function doInit() {
      try {
        await saveConfig(process.cwd(), {});
        console.log('✅ Created .rtsqlrc.json with default configuration');
      } catch (error) {
        console.error('❌ Failed to create configuration:', error);
        process.exit(1);
      }
    }
    doInit();
  }, []);

  return null;
}
