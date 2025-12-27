/**
 * Check if a template path contains the WIP indicator.
 * Uses the wipIndicator from the already-loaded config to ensure consistency.
 *
 * @param templatePath - The path to the template file
 * @param wipIndicator - The WIP indicator string from config (e.g., '.wip')
 * @returns true if the path contains the WIP indicator
 */
export function isWipTemplate(templatePath: string, wipIndicator: string): boolean {
  return templatePath.includes(wipIndicator);
}
