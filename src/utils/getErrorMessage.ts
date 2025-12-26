/**
 * Extracts error message from unknown error type.
 * Handles Error instances and arbitrary values.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Checks if an error is an Inquirer prompt exit (Ctrl+C).
 */
export function isPromptExit(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
}
