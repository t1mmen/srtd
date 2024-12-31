// utils/logger.ts
import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(`  ${msg}`),
  success: (msg: string) => console.log(`  ✅ ${chalk.green(msg)}`),
  warn: (msg: string) => console.log(`  ⚠️  ${chalk.yellow(msg)}`),
  error: (msg: string) => console.log(`  ❌ ${chalk.red(msg)}`),
  skip: (msg: string) => console.log(`  ↪️ ${chalk.dim(msg)}`),
  debug: (msg: string) =>
    process.env.DEBUG && process.env.DEBUG === 'true' && console.log(`  🔍 ${chalk.white(msg)}`),
};

export type LogLevel = keyof typeof logger;
