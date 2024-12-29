import { getConfig } from './config.js';

export async function isWipTemplate(templatePath: string): Promise<boolean> {
  const config = await getConfig();
  return templatePath.includes(config.wipIndicator);
}
