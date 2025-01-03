// hooks/useFullscreen.ts
import { useEffect } from 'react';

const ENTER_FULLSCREEN = '\x1b[?1049h';
const EXIT_FULLSCREEN = '\x1b[?1049l';

export function useFullscreen() {
  useEffect(() => {
    process.stdout.write(ENTER_FULLSCREEN);

    const cleanup = () => {
      process.stdout.write(EXIT_FULLSCREEN);
    };

    process.on('exit', cleanup);

    return () => {
      cleanup();
      process.off('exit', cleanup);
    };
  }, []);
}
