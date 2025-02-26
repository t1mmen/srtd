import { describe, expect, it } from 'vitest';
import { calculateMD5 } from './calculateMD5.js';

describe('calculateMD5', () => {
  it('should calculate MD5 hash correctly', async () => {
    // Test with known MD5 hashes
    expect(await calculateMD5('')).toBe('d41d8cd98f00b204e9800998ecf8427e'); // Empty string
    expect(await calculateMD5('test')).toBe('098f6bcd4621d373cade4e832627b4f6'); // "test"
    expect(await calculateMD5('hello world')).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3'); // "hello world"
  });

  it('should return same hash for same input', async () => {
    const input = 'some arbitrary content 123%$';
    const hash1 = await calculateMD5(input);
    const hash2 = await calculateMD5(input);
    expect(hash1).toBe(hash2);
  });

  it('should return different hash for different input', async () => {
    const hash1 = await calculateMD5('content1');
    const hash2 = await calculateMD5('content2');
    expect(hash1).not.toBe(hash2);
  });
});
