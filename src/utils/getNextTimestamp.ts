/**
 * Result of generating a new timestamp.
 */
export interface TimestampResult {
  /** The timestamp to use for the migration */
  timestamp: string;
  /** The new lastTimestamp value to store (may be same as timestamp) */
  newLastTimestamp: string;
}

/**
 * Generate the next unique migration timestamp.
 *
 * This is a PURE function - it does not mutate any state.
 * The caller is responsible for updating lastTimestamp in the build log.
 *
 * @param lastTimestamp - The last timestamp used (from build log)
 * @returns Object containing the new timestamp and the value to store as lastTimestamp
 */
export function getNextTimestamp(lastTimestamp: string): TimestampResult {
  const now = new Date();
  const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);

  if (timestamp <= lastTimestamp) {
    // Clock hasn't advanced past last timestamp, increment
    const nextTimestamp = (BigInt(lastTimestamp) + 1n).toString();
    return {
      timestamp: nextTimestamp,
      newLastTimestamp: nextTimestamp,
    };
  }

  return {
    timestamp,
    newLastTimestamp: timestamp,
  };
}
