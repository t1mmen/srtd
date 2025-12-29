/**
 * SQL Dependency Parser
 *
 * Extracts declarations and references from SQL templates to enable
 * automatic dependency ordering.
 *
 * Known limitations:
 * - CTEs (WITH clauses) are not recognized as local definitions
 * - Subqueries in FROM clause not fully parsed
 * - Quoted identifiers ("Table Name") not fully supported
 */

/**
 * A SQL object declaration (table, view, function, etc.)
 */
export interface Declaration {
  type: 'table' | 'view' | 'function' | 'trigger' | 'policy';
  name: string;
}

/**
 * Strip comments and string literals from SQL to prevent false matches
 *
 * Removes:
 * - Single-line comments: -- comment
 * - Multi-line comments: /* comment * /
 * - Single-quoted strings: 'string value'
 * - Double-quoted identifiers: "identifier" (but keeps the quotes for detection)
 */
export function stripSqlNoise(sql: string): string {
  // Remove multi-line comments first (they can span lines)
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Remove single-line comments (-- to end of line)
  result = result.replace(/--[^\n\r]*/g, ' ');

  // Remove single-quoted strings (handle escaped quotes: '')
  result = result.replace(/'(?:[^']|'')*'/g, "''");

  return result;
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

  // Strip comments and strings to avoid false matches
  const cleanSql = stripSqlNoise(sql);

  for (const { type, pattern } of DECLARATION_PATTERNS) {
    // Create fresh regex to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = cleanSql.matchAll(regex);
    for (const match of matches) {
      const name = match[1];
      if (name) {
        declarations.push({ type, name });
      }
    }
  }

  return declarations;
}

/**
 * Patterns for extracting SQL references (dependencies)
 */
const REFERENCE_PATTERNS = [
  // JOIN clause: JOIN table_name, LEFT JOIN table_name, etc.
  /JOIN\s+([a-zA-Z_][\w.]*)/gi,
  // REFERENCES clause (foreign keys): REFERENCES table_name(column)
  /REFERENCES\s+([a-zA-Z_][\w.]*)/gi,
];

/**
 * Pattern to match FROM clause with optional comma-separated tables
 * Captures: FROM table1, table2, table3 ...
 */
const FROM_PATTERN = /FROM\s+([a-zA-Z_][\w.]*(?:\s*,\s*[a-zA-Z_][\w.]*)*)/gi;

/**
 * Extract all references (FROM, JOIN, REFERENCES, etc.) from SQL
 * Optionally exclude declarations to avoid self-references
 */
export function extractReferences(sql: string, exclude: Declaration[] = []): string[] {
  const references = new Set<string>();
  const excludeNames = new Set(exclude.map(d => d.name.toLowerCase()));

  // Strip comments and strings to avoid false matches
  const cleanSql = stripSqlNoise(sql);

  // Handle FROM clause specially (comma-separated tables)
  const fromMatches = cleanSql.matchAll(FROM_PATTERN);
  for (const match of fromMatches) {
    const tableList = match[1];
    if (!tableList) continue;
    // Split by comma and trim each table name
    const tables = tableList.split(',').map(t => t.trim().split(/\s+/)[0]);
    for (const table of tables) {
      if (table && !excludeNames.has(table.toLowerCase())) {
        references.add(table);
      }
    }
  }

  // Handle other patterns (JOIN, REFERENCES)
  for (const pattern of REFERENCE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = cleanSql.matchAll(regex);
    for (const match of matches) {
      const name = match[1];
      if (name && !excludeNames.has(name.toLowerCase())) {
        references.add(name);
      }
    }
  }

  return Array.from(references);
}
