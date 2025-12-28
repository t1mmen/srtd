const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_DAY = 86400;
const JUST_NOW_THRESHOLD = 5;

/**
 * Format a date as relative time (e.g., "5m ago", "2h ago").
 */
function relative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < JUST_NOW_THRESHOLD) return 'just now';
  if (seconds < SECONDS_IN_MINUTE) return `${seconds}s ago`;
  if (seconds < SECONDS_IN_HOUR) return `${Math.floor(seconds / SECONDS_IN_MINUTE)}m ago`;
  if (seconds < SECONDS_IN_DAY) return `${Math.floor(seconds / SECONDS_IN_HOUR)}h ago`;
  return `${Math.floor(seconds / SECONDS_IN_DAY)}d ago`;
}

/**
 * Format a date as HH:MM:SS timestamp.
 */
function timestamp(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export const formatTime = {
  relative,
  timestamp,
};
