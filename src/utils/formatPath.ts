import path from 'node:path';

function truncatePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  if (parts.length <= 1) {
    return filePath;
  }

  const [parent, filename] = parts.slice(-2);
  return `…/${parent}/${filename}`;
}

function getFilename(filePath: string): string {
  return path.basename(filePath);
}

export const formatPath = {
  truncatePath,
  getFilename,
};
