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

    it('returns days for >= 24 hours', () => {
      const date = new Date('2024-12-25T12:00:00Z');
      expect(formatTime.relative(date)).toBe('2d ago');
    });

    it('accepts ISO string', () => {
      expect(formatTime.relative('2024-12-27T11:59:57Z')).toBe('just now');
    });
  });

  describe('timestamp', () => {
    it('formats time as HH:MM:SS', () => {
      const date = new Date('2024-12-27T14:35:22Z');
      expect(formatTime.timestamp(date)).toBe('14:35:22');
    });

    it('pads single digits', () => {
      const date = new Date('2024-12-27T09:05:02Z');
      expect(formatTime.timestamp(date)).toBe('09:05:02');
    });
  });
});
