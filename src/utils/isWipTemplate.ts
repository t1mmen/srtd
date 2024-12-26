import { loadConfig } from './config.js';

export async function isWipTemplate(templatePath: string): Promise<boolean> {
  const config = await loadConfig();
  return templatePath.includes(config.wipIndicator);
}
