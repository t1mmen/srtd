import crypto from 'node:crypto';

export async function calculateMD5(content: string): Promise<string> {
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('md5').update(normalized).digest('hex');
}
