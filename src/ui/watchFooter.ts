import chalk from 'chalk';

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
  /** Optional destination path to display above shortcuts */
  destination?: string;
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
 * dest: supabase/migrations
 * q quit  u toggle unchanged  b build all
 * ```
 *
 * Keys are rendered dim, labels in normal text, separated by double-space.
 * Uses a blank line for spacing instead of a separator line.
 */
export function renderWatchFooter(options?: WatchFooterOptions): void {
  const shortcuts = options?.shortcuts ?? DEFAULT_WATCH_SHORTCUTS;
  const destination = options?.destination;

  // Blank line for spacing (instead of separator)
  console.log();

  // Render destination if provided
  if (destination) {
    console.log(chalk.dim(`dest: ${destination}`));
  }

  // Render shortcuts line (if any)
  if (shortcuts.length > 0) {
    const shortcutLine = shortcuts
      .map(shortcut => `${chalk.dim(shortcut.key)} ${shortcut.label}`)
      .join('  '); // Double-space separator

    console.log(shortcutLine);
  }
}
