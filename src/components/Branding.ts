import type { Terminal } from 'terminal-kit';
import packageJson from '../../package.json' with { type: 'json' };
import { AbstractComponent } from '../lib/tui/index.js';
import { connect } from '../utils/databaseConnection.js';

interface BrandingProps {
  subtitle?: string;
}

export class Branding extends AbstractComponent<BrandingProps> {
  constructor(terminal: Terminal, props: BrandingProps) {
    super(terminal, props);
  }

  protected async render(): Promise<void> {
    const { subtitle } = this.props;

    // Check database connection status
    let isConnected = false;
    try {
      const client = await connect();
      if (client) {
        isConnected = true;
        client.release();
      }
    } catch {
      isConnected = false;
    }

    // Clear and position
    this.terminal('\n');

    // Render badge
    if (isConnected) {
      this.terminal.bgGreen.white(' srtd ');
    } else {
      this.terminal.bgYellow.white(' srtd ');
    }

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
