import chalk from 'chalk';
import packageJson from '../../package.json' with { type: 'json' };
import type { DatabaseService } from '../services/DatabaseService.js';

export interface BrandingOptions {
  subtitle?: string;
}

/**
 * Renders the srtd branding header with connection status badge.
 * @see {@link DatabaseService.testConnection} - Database connection check
 */
export async function renderBranding(
  options: BrandingOptions = {},
  dbService?: DatabaseService
): Promise<void> {
  const { subtitle } = options;

  // Check database connection status
  let isConnected = false;
  if (dbService) {
    try {
      isConnected = await dbService.testConnection();
    } catch {
      isConnected = false;
    }
  }

  console.log();

  // Render badge
  const badge = isConnected ? chalk.bgGreen.white(' srtd ') : chalk.bgYellow.white(' srtd ');

  // Render subtitle or main title
  let title: string;
  if (subtitle) {
    title = subtitle;
  } else {
    title = `${chalk.green.bold('S')}upabase ${chalk.green.bold('R')}epeatable ${chalk.green.bold('T')}emplate ${chalk.green.bold('D')}efinitions`;
  }

  // Version
  const version = chalk.dim(` v${packageJson.version}`);

  console.log(`${badge} ${title}${version}`);
  console.log();
}
