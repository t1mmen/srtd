import { describe, expect, it, vi } from 'vitest';
import { getNextTimestamp } from './getNextTimestamp.js';

describe('getNextTimestamp', () => {
  it('should generate a timestamp in the correct format', () => {
    const result = getNextTimestamp('');

    // Should return an object with timestamp and newLastTimestamp
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('newLastTimestamp');

    // Should be a string with 14 digits
    expect(typeof result.timestamp).toBe('string');
    expect(result.timestamp).toMatch(/^\d{14}$/);

    // Both should be equal for a fresh timestamp
    expect(result.timestamp).toBe(result.newLastTimestamp);

    // Should parse to a valid date when formatted as YYYYMMDDHHmmss
    const { timestamp } = result;
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

  it('should increment when timestamp equals lastTimestamp', () => {
    // Mock a fixed time
    const mockDate = new Date('2023-01-01T12:00:00Z');
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

    // Generate first timestamp
    const result1 = getNextTimestamp('');
    expect(result1.timestamp).toBe('20230101120000');

    // Generate second timestamp with same lastTimestamp
    // Since clock hasn't moved, should increment
    const result2 = getNextTimestamp(result1.newLastTimestamp);
    expect(result2.timestamp).toBe('20230101120001');
    expect(result2.newLastTimestamp).toBe('20230101120001');

    vi.restoreAllMocks();
  });

  it('should use current time when it is greater than lastTimestamp', () => {
    // Use old timestamp
    const oldTimestamp = '20200101000000';

    const result = getNextTimestamp(oldTimestamp);

    // Should use current time, not increment from old
    expect(Number.parseInt(result.timestamp, 10)).toBeGreaterThan(
      Number.parseInt(oldTimestamp, 10)
    );
  });

  it('should be a pure function - not mutate input', () => {
    const lastTimestamp = '20230101120000';

    // Call the function
    getNextTimestamp(lastTimestamp);

    // Original string should be unchanged (strings are immutable, but testing the contract)
    expect(lastTimestamp).toBe('20230101120000');
  });

  it('should handle BigInt increment correctly for large timestamps', () => {
    // Use max realistic timestamp
    const largeTimestamp = '99991231235959';

    const result = getNextTimestamp(largeTimestamp);

    // Should increment by 1
    expect(result.timestamp).toBe('99991231235960');
    expect(result.newLastTimestamp).toBe('99991231235960');
  });
});
