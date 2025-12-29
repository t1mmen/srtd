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

  // Dark green/white badge
  const badge = chalk.bgAnsi256(22).white(' srtd ');

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
