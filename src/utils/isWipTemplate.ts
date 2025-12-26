import { getConfig } from './config.js';

export async function isWipTemplate(templatePath: string, baseDir?: string): Promise<boolean> {
  const config = await getConfig(baseDir);
  return templatePath.includes(config.wipIndicator);
}
