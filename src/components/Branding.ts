import type { Terminal } from 'terminal-kit';
import packageJson from '../../package.json' with { type: 'json' };
import { useDatabaseConnection } from '../hooks/useDatabaseConnection.js';
import { AbstractComponent, Box, Text } from '../lib/tui/index.js';
import { COLOR_ERROR, COLOR_SUPABASE, COLOR_WARNING } from './customTheme.js';

interface BrandingProps {
  subtitle?: string;
}

export class Branding extends AbstractComponent<BrandingProps> {
  constructor(terminal: Terminal, props: BrandingProps) {
    super(terminal, props);
  }

  protected render(): void {
    const { subtitle } = this.props;
    const { error, isConnected } = useDatabaseConnection();

    const badgeColor = error ? COLOR_ERROR : isConnected ? COLOR_SUPABASE : COLOR_WARNING;

    // Clear and position
    this.terminal('\n');

    // Render badge
    const bgColorMethod =
      badgeColor === COLOR_ERROR ? 'bgRed' : badgeColor === COLOR_SUPABASE ? 'bgGreen' : 'bgYellow';
    (this.terminal as any)[bgColorMethod].white(' srtd ');

    this.terminal(' ');

    // Render subtitle or main title
    if (subtitle) {
      this.terminal(subtitle);
    } else {
      // Render SRTD with colored letters
      this.terminal.green.bold('S');
      this.terminal('upabase ');
      this.terminal.green.bold('R');
      this.terminal('epeatable ');
      this.terminal.green.bold('T');
      this.terminal('emplate ');
      this.terminal.green.bold('D');
      this.terminal('efinitions');
    }

    // Version
    this.terminal.dim(` v${packageJson.version}`);
    this.terminal('\n\n');
  }
}

export default function BrandingComponent(terminal: Terminal, props: BrandingProps = {}) {
  const branding = new Branding(terminal, props);
  branding.mount();
  return branding;
}
