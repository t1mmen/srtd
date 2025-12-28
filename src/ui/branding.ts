import chalk from 'chalk';
import packageJson from '../../package.json' with { type: 'json' };

export interface BrandingOptions {
  subtitle?: string;
}

/**
 * Renders the srtd branding header with blue/white badge.
 *
 * Usage:
 * - Menu: renderBranding() → " srtd  Supabase Repeatable Template Definitions v0.4.7"
 * - Direct command: renderBranding({ subtitle: 'Build' }) → " srtd  Build v0.4.7"
 */
export function renderBranding(options: BrandingOptions = {}): void {
  const { subtitle } = options;

  console.log();

  // Blue/white badge
  const badge = chalk.bgBlue.white(' srtd ');

  // Render subtitle or main title
  let title: string;
  if (subtitle) {
    title = subtitle;
  } else {
    title = `${chalk.blue.bold('S')}upabase ${chalk.blue.bold('R')}epeatable ${chalk.blue.bold('T')}emplate ${chalk.blue.bold('D')}efinitions`;
  }

  // Version
  const version = chalk.dim(` v${packageJson.version}`);

  console.log(`${badge} ${title}${version}`);
  console.log();
}
