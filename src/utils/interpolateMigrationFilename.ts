/**
 * Interpolation utility for migration filename templates
 * Supports $timestamp, $migrationName, and $prefix variables
 */

/**
 * Interpolation options for migration filename templates
 */
export interface InterpolationOptions {
  /** The template string with $timestamp, $migrationName, $prefix variables */
  template: string;
  /** The timestamp for the migration (e.g., '20240101123456') */
  timestamp: string;
  /** The migration name (template name or 'bundle') */
  migrationName: string;
  /** Optional prefix (e.g., 'srtd'). When present, adds trailing dash. */
  prefix?: string;
}

/**
 * Interpolate a migration filename template with the provided values.
 *
 * Supported variables:
 * - $timestamp: The migration timestamp
 * - $migrationName: The template name (or 'bundle' for bundled migrations)
 * - $prefix: The migration prefix with trailing dash (empty if no prefix)
 *
 * @example
 * // Default pattern (backward compatible)
 * interpolateMigrationFilename({
 *   template: '$timestamp_$prefix$migrationName.sql',
 *   timestamp: '20240101123456',
 *   migrationName: 'create_users',
 *   prefix: 'srtd'
 * });
 * // Returns: '20240101123456_srtd-create_users.sql'
 *
 * @example
 * // Directory-based pattern (Issue #41)
 * interpolateMigrationFilename({
 *   template: '$migrationName/migrate.sql',
 *   timestamp: '20240101123456',
 *   migrationName: 'create_users',
 *   prefix: 'srtd'
 * });
 * // Returns: 'create_users/migrate.sql'
 */
export function interpolateMigrationFilename(options: InterpolationOptions): string {
  const { template, timestamp, migrationName, prefix } = options;

  // Prefix gets a trailing dash when it exists, empty string otherwise
  const prefixValue = prefix ? `${prefix}-` : '';

  // Use replacer functions to prevent special replacement patterns (e.g., $&, $`)
  return template
    .replace(/\$timestamp/g, () => timestamp)
    .replace(/\$migrationName/g, () => migrationName)
    .replace(/\$prefix/g, () => prefixValue);
}
