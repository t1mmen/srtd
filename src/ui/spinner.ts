import ora, { type Ora } from 'ora';

/**
 * Creates a new spinner with the dots style.
 */
export function createSpinner(text: string): Ora {
  return ora({ text, spinner: 'dots' });
}
