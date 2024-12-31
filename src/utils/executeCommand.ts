// utils/executeCommand.ts
import { spawn } from 'node:child_process';
import { logger } from './logger.js';

interface ExecuteCommandOptions {
  cwd?: string;
  silent?: boolean;
}

export async function executeCommand(
  command: string,
  args: string[] = [],
  options: ExecuteCommandOptions = { silent: true }
): Promise<boolean> {
  return new Promise(resolve => {
    if (!options.silent) {
      logger.info(`Running: ${command} ${args.join(' ')}`);
    }

    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: 'inherit', // This connects the child process stdio to the parent
      shell: process.platform === 'win32', // Use shell on Windows for better command resolution
    });

    child.on('error', error => {
      if (!options.silent) {
        logger.error(`Failed to start command: ${error.message}`);
      }
      resolve(false);
    });

    child.on('exit', code => {
      if (code === 0) {
        if (!options.silent) {
          logger.success(`Command completed successfully`);
        }
        resolve(true);
      } else {
        if (!options.silent) {
          logger.error(`Command failed with code ${code}`);
        }
        resolve(false);
      }
    });
  });
}
