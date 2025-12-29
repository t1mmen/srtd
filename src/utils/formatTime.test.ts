import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTime } from './formatTime.js';

describe('formatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-27T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('relative', () => {
    it('returns "just now" for < 5 seconds', () => {
      const date = new Date('2024-12-27T11:59:57Z');
      expect(formatTime.relative(date)).toBe('just now');
    });

    it('returns seconds for < 60 seconds', () => {
      const date = new Date('2024-12-27T11:59:30Z');
      expect(formatTime.relative(date)).toBe('30s ago');
    });

    it('returns minutes for < 60 minutes', () => {
      const date = new Date('2024-12-27T11:45:00Z');
      expect(formatTime.relative(date)).toBe('15m ago');
    });

    it('returns hours for < 24 hours', () => {
      const date = new Date('2024-12-27T10:00:00Z');
      expect(formatTime.relative(date)).toBe('2h ago');
    });

    it('returns days for < 7 days', () => {
      const date = new Date('2024-12-25T12:00:00Z');
      expect(formatTime.relative(date)).toBe('2d ago');
    });

    it('falls back to full format for >= 7 days', () => {
      const date = new Date('2024-12-15T12:00:00Z');
      // Should return full format like "Dec 15 HH:MM" (local time)
      expect(formatTime.relative(date)).toMatch(/^Dec 15 \d{2}:\d{2}$/);
    });

    it('accepts ISO string', () => {
      expect(formatTime.relative('2024-12-27T11:59:57Z')).toBe('just now');
    });
  });

  describe('time', () => {
    it('formats time as HH:MM:SS in local time', () => {
      // Create a date and verify it formats with local hours
      const date = new Date();
      date.setHours(14, 35, 22);
      expect(formatTime.time(date)).toBe('14:35:22');
    });

    it('pads single digits', () => {
      const date = new Date();
      date.setHours(9, 5, 2);
      expect(formatTime.time(date)).toBe('09:05:02');
    });

    it('accepts ISO string', () => {
      const date = new Date();
      date.setHours(10, 30, 45);
      expect(formatTime.time(date.toISOString())).toBe('10:30:45');
    });
  });

  describe('full', () => {
    it('formats as "Mon DD HH:MM"', () => {
      const date = new Date();
      date.setMonth(11); // December (0-indexed)
      date.setDate(28);
      date.setHours(10, 23);
      expect(formatTime.full(date)).toBe('Dec 28 10:23');
    });

    it('accepts ISO string', () => {
      const date = new Date();
      date.setMonth(0); // January
      date.setDate(5);
      date.setHours(8, 15);
      expect(formatTime.full(date.toISOString())).toBe('Jan 5 08:15');
    });
  });

  describe('formatTimestamp', () => {
    it('returns time format for "time"', () => {
      const date = new Date();
      date.setHours(14, 35, 22);
      expect(formatTime.formatTimestamp(date, 'time')).toBe('14:35:22');
    });

    it('returns relative format for "relative"', () => {
      const date = new Date('2024-12-27T11:45:00Z');
      expect(formatTime.formatTimestamp(date, 'relative')).toBe('15m ago');
    });

    it('returns full format for "full"', () => {
      const date = new Date();
      date.setMonth(11);
      date.setDate(28);
      date.setHours(10, 23);
      expect(formatTime.formatTimestamp(date, 'full')).toBe('Dec 28 10:23');
    });
  });

  // Legacy alias test
  describe('timestamp (legacy alias)', () => {
    it('works the same as time()', () => {
      const date = new Date();
      date.setHours(14, 35, 22);
      expect(formatTime.timestamp(date)).toBe(formatTime.time(date));
    });
  });
});
