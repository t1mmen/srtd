/**
 * Template Dependency Parser
 *
 * Extracts explicit dependencies from @depends-on comments.
 * No SQL parsing - dependencies are declared by the user.
 *
 * Format:
 *   -- @depends-on: file1.sql, file2.sql
 */

/**
 * Extract dependencies from @depends-on comments in SQL template
 *
 * Parses single-line comments with format:
 *   -- @depends-on: file1.sql, file2.sql, file3.sql
 *
 * Multiple @depends-on comments are merged. Duplicates are removed.
 * The comment must use -- prefix (not block comments).
 *
 * @param sql - SQL template content
 * @returns Array of dependency filenames (deduplicated)
 */
export function extractDependsOn(sql: string): string[] {
  const dependencies = new Set<string>();

  // Match: -- @depends-on: file1.sql, file2.sql
  // Case-insensitive, allows whitespace (but not newlines after colon)
  // Use [ \t]* instead of \s* to avoid matching newlines
  const pattern = /^--[ \t]*@depends-on:[ \t]*([^\n\r]*)$/gim;

  for (const match of sql.matchAll(pattern)) {
    const fileList = match[1];
    if (!fileList) continue;

    // Split by comma, trim whitespace, filter empty
    const files = fileList
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    for (const file of files) {
      dependencies.add(file);
    }
  }

  return Array.from(dependencies);
}
