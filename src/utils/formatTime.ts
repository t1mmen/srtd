const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_DAY = 86400;
const SECONDS_IN_WEEK = 604800;
const JUST_NOW_THRESHOLD = 5;

export type TimeFormat = 'time' | 'relative' | 'full';

/**
 * Format a date as relative time (e.g., "5m ago", "2h ago").
 * Falls back to full format after 7 days.
 */
function relative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < JUST_NOW_THRESHOLD) return 'just now';
  if (seconds < SECONDS_IN_MINUTE) return `${seconds}s ago`;
  if (seconds < SECONDS_IN_HOUR) return `${Math.floor(seconds / SECONDS_IN_MINUTE)}m ago`;
  if (seconds < SECONDS_IN_DAY) return `${Math.floor(seconds / SECONDS_IN_HOUR)}h ago`;
  if (seconds < SECONDS_IN_WEEK) return `${Math.floor(seconds / SECONDS_IN_DAY)}d ago`;
  // Fall back to full format for older dates
  return full(d);
}

/**
 * Format a date as HH:MM:SS timestamp (local time).
 */
function time(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Format a date as "Mon DD HH:MM" (e.g., "Dec 28 10:23").
 */
function full(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const mon = months[d.getMonth()];
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${mon} ${day} ${h}:${m}`;
}

/**
 * Unified timestamp formatter with three modes:
 * - 'time': HH:MM:SS (for watch activity log)
 * - 'relative': "2m ago", "3d ago" (for results table)
 * - 'full': "Dec 28 10:23" (for older items)
 */
function formatTimestamp(date: Date | string, format: TimeFormat): string {
  switch (format) {
    case 'time':
      return time(date);
    case 'relative':
      return relative(date);
    case 'full':
      return full(date);
  }
}

// Legacy alias for backward compatibility during refactor
const timestamp = time;

export const formatTime = {
  relative,
  time,
  timestamp,
  full,
  formatTimestamp,
};
