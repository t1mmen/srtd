import path from 'node:path';

function truncatePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  if (parts.length <= 2) {
    return filePath;
  }

  const [parent, filename] = parts.slice(-2);
  return `…/${parent}/${filename}`;
}

function getFilename(filePath: string): string {
  return path.basename(filePath);
}

function ensureSqlExtension(name: string): string {
  const filename = getFilename(name);
  return filename.endsWith('.sql') ? filename : `${filename}.sql`;
}

export const formatPath = {
  truncatePath,
  getFilename,
  ensureSqlExtension,
};
