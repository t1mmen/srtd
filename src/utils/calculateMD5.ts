import crypto from 'node:crypto';

export async function calculateMD5(content: string): Promise<string> {
  return crypto.createHash('md5').update(content).digest('hex');
}
