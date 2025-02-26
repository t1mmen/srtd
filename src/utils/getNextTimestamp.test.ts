import { describe, expect, it, vi } from 'vitest';
import type { BuildLog } from '../types.js';
import { getNextTimestamp } from './getNextTimestamp.js';

describe('getNextTimestamp', () => {
  it('should generate a timestamp in the correct format', async () => {
    // Create a mock BuildLog
    const mockBuildLog: BuildLog = {
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    };

    const timestamp = await getNextTimestamp(mockBuildLog);

    // Should be a string with 14 digits
    expect(typeof timestamp).toBe('string');
    expect(timestamp).toMatch(/^\d{14}$/);

    // Should parse to a valid date when formatted as YYYYMMDDHHmmss
    const year = Number.parseInt(timestamp.substring(0, 4), 10);
    const month = Number.parseInt(timestamp.substring(4, 6), 10);
    const day = Number.parseInt(timestamp.substring(6, 8), 10);
    const hour = Number.parseInt(timestamp.substring(8, 10), 10);
    const minute = Number.parseInt(timestamp.substring(10, 12), 10);
    const second = Number.parseInt(timestamp.substring(12, 14), 10);

    expect(year).toBeGreaterThanOrEqual(2020);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
    expect(hour).toBeLessThanOrEqual(23);
    expect(minute).toBeLessThanOrEqual(59);
    expect(second).toBeLessThanOrEqual(59);
  });

  it('should generate timestamps that increment correctly', async () => {
    // Create a mock BuildLog
    const mockBuildLog: BuildLog = {
      version: '1.0',
      templates: {},
      lastTimestamp: '',
    };

    // Mock Date.now to control the timestamp generation
    const mockDate = new Date('2023-01-01T12:00:00Z');
    vi.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime());

    const timestamp1 = await getNextTimestamp(mockBuildLog);

    // Increment the mock date by 1 second
    mockDate.setSeconds(mockDate.getSeconds() + 1);
    const timestamp2 = await getNextTimestamp(mockBuildLog);

    // Timestamps should be different
    expect(timestamp1).not.toBe(timestamp2);

    // Second timestamp should be greater
    expect(Number.parseInt(timestamp2, 10)).toBeGreaterThan(Number.parseInt(timestamp1, 10));

    // The difference should be exactly 1 second
    const secondsDigits = -2; // Last 2 digits represent seconds
    const timestamp1Seconds = timestamp1.slice(secondsDigits);
    const timestamp2Seconds = timestamp2.slice(secondsDigits);
    const timestamp1RestDigits = timestamp1.slice(0, secondsDigits);
    const timestamp2RestDigits = timestamp2.slice(0, secondsDigits);

    if (timestamp1RestDigits === timestamp2RestDigits) {
      // If only seconds differ
      expect(Number.parseInt(timestamp2Seconds, 10) - Number.parseInt(timestamp1Seconds, 10)).toBe(
        1
      );
    }
  });
});
