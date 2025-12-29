/**
 * Error hints for common Postgres error codes
 * Maps error codes to actionable suggestions for users
 */

/** Known Postgres error codes mapped to actionable hints */
const ERROR_CODE_HINTS: Record<string, string> = {
  // Class 42 - Syntax Error or Access Rule Violation
  '42703': 'Column does not exist. Check spelling or ensure the migration that creates it has run.',
  '42P01': 'Table or view does not exist. Ensure the migration that creates it has run first.',
  '42883': 'Function does not exist. Check function name spelling and argument types.',
  '42601': 'SQL syntax error. Check for typos, missing commas, or unbalanced parentheses.',
  '42501': 'Insufficient privileges. Check database user permissions.',
  '42710': 'Object already exists. The CREATE statement may need IF NOT EXISTS.',
  '42P07': 'Table already exists. Use CREATE TABLE IF NOT EXISTS.',

  // Class 23 - Integrity Constraint Violation
  '23505': 'Unique constraint violated. A row with this key already exists (duplicate).',
  '23503': 'Foreign key violation. The referenced row does not exist or would be orphaned.',
  '23502': 'NOT NULL violation. A required column is missing a value.',
  '23514': 'Check constraint violated. The value does not meet the constraint condition.',

  // Class 25 - Invalid Transaction State
  '25P02': 'Transaction aborted. A previous statement in this transaction failed.',

  // Class 40 - Transaction Rollback
  '40001': 'Serialization failure. Concurrent transaction conflict - retry may succeed.',
  '40P01': 'Deadlock detected. Simplify transaction or retry.',

  // Class 53 - Insufficient Resources
  '53300': 'Too many connections. Close unused connections or increase max_connections.',

  // Class 57 - Operator Intervention
  '57014': 'Query cancelled. Statement timeout or manual cancellation.',

  // Class 08 - Connection Exception
  '08006': 'Connection failure. Check database server is running and accessible.',
};

/** Pattern-based hints for when error code is not available */
const ERROR_PATTERN_HINTS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /permission denied/i,
    hint: 'Permission denied. Check database user has required privileges (SELECT, INSERT, etc.).',
  },
  {
    pattern: /connection refused/i,
    hint: 'Connection refused. Verify database server is running and connection string is correct.',
  },
  {
    pattern: /authentication failed/i,
    hint: 'Authentication failed. Check username and password in connection string.',
  },
  {
    pattern: /does not exist/i,
    hint: 'Object does not exist. Ensure dependent migrations have run first.',
  },
  {
    pattern: /already exists/i,
    hint: 'Object already exists. Consider using IF NOT EXISTS or OR REPLACE.',
  },
  {
    pattern: /timeout/i,
    hint: 'Operation timed out. Query may be too slow or database is overloaded.',
  },
];

/**
 * Get an actionable hint for a Postgres error
 * @param code - Postgres error code (e.g., '42P01')
 * @param detail - Error detail message for pattern matching fallback
 * @returns Actionable hint string, or undefined if no hint available
 */
export function getErrorHint(
  code: string | undefined,
  detail: string | undefined
): string | undefined {
  // Try code-based lookup first (normalize to uppercase for defensive matching)
  if (code) {
    const normalizedCode = code.toUpperCase();
    if (ERROR_CODE_HINTS[normalizedCode]) {
      return ERROR_CODE_HINTS[normalizedCode];
    }
  }

  // Fall back to pattern matching on detail message
  if (detail) {
    for (const { pattern, hint } of ERROR_PATTERN_HINTS) {
      if (pattern.test(detail)) {
        return hint;
      }
    }
  }

  return undefined;
}
