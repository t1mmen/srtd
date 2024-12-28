import chalk from 'chalk';
import { MigrationError } from '../types.js';

export function displayErrorSummary(errors: MigrationError[]): void {
  if (errors.length === 0) return;

  console.log('\n  ❌ Error Summary:');
  console.log('  ================');
  errors.forEach(({ templateName, error }) => {
    console.log(`\n  Failed migration: ${chalk.red(templateName)}`);
    console.log(`  ${error.split('\n').join('\n  ')}`);
  });
  console.log('\n  ⚠️  Some migrations failed. Please check the errors above.');
}
