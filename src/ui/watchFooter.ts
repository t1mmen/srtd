import chalk from 'chalk';
import { SEPARATOR } from './constants.js';

/**
 * A keyboard shortcut definition for the watch footer.
 */
export interface WatchFooterShortcut {
  /** The key to press (e.g., 'q') */
  key: string;
  /** The label describing the action (e.g., 'quit') */
  label: string;
}

/**
 * Options for rendering the watch footer.
 */
export interface WatchFooterOptions {
  /** Custom shortcuts to display, or use DEFAULT_WATCH_SHORTCUTS if not provided */
  shortcuts?: WatchFooterShortcut[];
}

/**
 * Default keyboard shortcuts for watch mode.
 * - q: quit watch mode
 * - u: toggle showing unchanged templates in header
 * - b: trigger build for all pending templates
 */
export const DEFAULT_WATCH_SHORTCUTS: WatchFooterShortcut[] = [
  { key: 'q', label: 'quit' },
  { key: 'u', label: 'toggle unchanged' },
  { key: 'b', label: 'build all' },
];

/**
 * Renders the watch mode footer with keyboard shortcuts.
 *
 * Output format:
 * ```
 * ───────────────────────────────────────────────────
 * q quit  u toggle unchanged  b build all
 * ```
 *
 * Keys are rendered dim, labels in normal text, separated by double-space.
 */
export function renderWatchFooter(options?: WatchFooterOptions): void {
  const shortcuts = options?.shortcuts ?? DEFAULT_WATCH_SHORTCUTS;

  // Render separator line
  console.log(SEPARATOR);

  // Render shortcuts line (if any)
  if (shortcuts.length > 0) {
    const shortcutLine = shortcuts
      .map(shortcut => `${chalk.dim(shortcut.key)} ${shortcut.label}`)
      .join('  '); // Double-space separator

    console.log(shortcutLine);
  }
}
