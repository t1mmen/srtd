import chalk from 'chalk';
import figures from 'figures';
import { formatPath } from '../utils/formatPath.js';
import { formatTime } from '../utils/formatTime.js';
import { TIMESTAMP_COLUMN_WIDTH } from './constants.js';
import { renderErrorContext } from './errorContext.js';

export type WatchEventType = 'changed' | 'applied' | 'error';

export interface WatchLogEntry {
  type: WatchEventType;
  template: string; // Path to template
  timestamp: Date;
  message?: string; // Error message if type='error'
  sqlSnippet?: string; // SQL context for errors
  column?: number; // Caret position
  suffix?: string; // e.g., "(fixed)" for re-applied after error
}

/**
 * Icons for each event type.
 * - `bullet` (cyan) - file modified, pending apply
 * - `tick` (green) - successfully applied to DB
 * - `cross` (red) - apply failed
 */
const EVENT_ICONS: Record<WatchEventType, string> = {
  changed: figures.bullet,
  applied: figures.tick,
  error: figures.cross,
};

/**
 * Colors for each event type.
 */
const EVENT_COLORS: Record<WatchEventType, typeof chalk.cyan> = {
  changed: chalk.cyan,
  applied: chalk.green,
  error: chalk.red,
};

/**
 * Renders a single watch log entry to the console.
 *
 * Format:
 * 16:45:02  tick .../audit_trigger.sql applied
 * 16:45:15  bullet .../user_profile.sql changed
 * 16:46:03  cross .../broken.sql error
 *           | syntax error at line 5:
 *           | CREATE OR REPLACE FUNCTION broken_func(
 *           |                                        ^ expected parameter
 * 16:47:22  tick .../broken.sql applied (fixed)
 */
export function renderWatchLogEntry(entry: WatchLogEntry): void {
  const { type, template, timestamp, message, sqlSnippet, column, suffix } = entry;

  const time = formatTime.timestamp(timestamp);
  const icon = EVENT_ICONS[type];
  const color = EVENT_COLORS[type];
  const truncatedPath = formatPath.truncatePath(template);

  // Build the main line: "16:45:02  tick .../file.sql applied"
  let mainLine = `${chalk.dim(time)}  ${color(icon)} ${truncatedPath} ${type}`;

  // Add suffix if present (e.g., "(fixed)")
  if (suffix) {
    mainLine += ` ${chalk.dim(suffix)}`;
  }

  console.log(mainLine);

  // For errors, render additional context
  if (type === 'error') {
    const indent = ' '.repeat(TIMESTAMP_COLUMN_WIDTH);
    renderErrorContext({
      message,
      sqlSnippet,
      column,
      indentPrefix: indent,
    });
  }
}
