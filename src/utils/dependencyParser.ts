/**
 * SQL Dependency Parser
 *
 * Extracts declarations and references from SQL templates to enable
 * automatic dependency ordering.
 */

/**
 * A SQL object declaration (table, view, function, etc.)
 */
export interface Declaration {
  type: 'table' | 'view' | 'function' | 'trigger' | 'policy';
  name: string;
}

/**
 * Patterns for extracting SQL declarations
 * Each pattern captures the object name as the first group
 */
const DECLARATION_PATTERNS: { type: Declaration['type']; pattern: RegExp }[] = [
  {
    type: 'table',
    pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][\w.]*)/gi,
  },
  {
    type: 'view',
    pattern: /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+([a-zA-Z_][\w.]*)/gi,
  },
  {
    type: 'function',
    pattern: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z_][\w.]*)/gi,
  },
  {
    type: 'trigger',
    pattern: /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z_][\w.]*)/gi,
  },
  {
    type: 'policy',
    pattern: /CREATE\s+POLICY\s+([a-zA-Z_][\w.]*)/gi,
  },
];

/**
 * Extract all declarations (CREATE TABLE/VIEW/FUNCTION/etc) from SQL
 */
export function extractDeclarations(sql: string): Declaration[] {
  const declarations: Declaration[] = [];

  for (const { type, pattern } of DECLARATION_PATTERNS) {
    // Create fresh regex to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = sql.matchAll(regex);
    for (const match of matches) {
      declarations.push({ type, name: match[1] });
    }
  }

  return declarations;
}
