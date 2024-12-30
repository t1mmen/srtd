import type { BuildLog } from '../types.js';

export async function getNextTimestamp(buildLog: BuildLog): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);

  if (timestamp <= buildLog.lastTimestamp) {
    const nextTimestamp = (BigInt(buildLog.lastTimestamp) + 1n).toString();
    buildLog.lastTimestamp = nextTimestamp;
    return nextTimestamp;
  }

  buildLog.lastTimestamp = timestamp;
  return timestamp;
}
