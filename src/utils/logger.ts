// utils/logger.ts
import chalk from 'chalk';
import figures from 'figures';
export const logger = {
  info: (msg: string) => console.log(`${figures.info} ${msg}`),
  success: (msg: string) => console.log(`${figures.tick} ${chalk.green(msg)}`),
  warn: (msg: string) => console.log(`${figures.warning} ${chalk.yellow(msg)}`),
  error: (msg: string) => console.log(`${figures.cross} ${chalk.red(msg)}`),
  skip: (msg: string) => console.log(`${figures.pointerSmall} ${chalk.dim(msg)}`),
  debug: (msg: string) =>
    process.env.DEBUG && process.env.DEBUG === 'true' && console.log(`  🔍 ${chalk.white(msg)}`),
};
