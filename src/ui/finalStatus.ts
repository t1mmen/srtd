import chalk from 'chalk';
import figures from 'figures';

export interface FinalStatusOptions {
  /** Type of status to display */
  type: 'success' | 'warning' | 'error' | 'info';
  /** Main message to display */
  message: string;
}

/**
 * Render a final status message with consistent icon format.
 * Used for command completion messages.
 *
 * Pattern: [icon] [message]
 *
 * Examples:
 *   renderFinalStatus({ type: 'success', message: 'Built 3 templates' })
 *   renderFinalStatus({ type: 'warning', message: 'No WIP templates found' })
 *   renderFinalStatus({ type: 'info', message: 'No changes' })
 */
export function renderFinalStatus(options: FinalStatusOptions): void {
  const { type, message } = options;

  switch (type) {
    case 'success':
      console.log(chalk.green(`${figures.tick} ${message}`));
      break;
    case 'warning':
      console.log(chalk.yellow(`${figures.warning} ${message}`));
      break;
    case 'error':
      console.log(chalk.red(`${figures.cross} ${message}`));
      break;
    case 'info':
      console.log(chalk.dim(`${figures.bullet} ${message}`));
      break;
  }
}
