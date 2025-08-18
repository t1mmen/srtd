/**
 * Spinner component for Terminal-Kit
 * Replaces Ink's Spinner component
 */

import type { Terminal } from 'terminal-kit';
import { HookedComponent } from '../hooks.js';

export type SpinnerType = 'dots' | 'line' | 'arrow' | 'bouncingBar' | 'bouncingBall';

const SPINNER_FRAMES = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bouncingBar: ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[ ===]', '[  ==]', '[   =]', '[    ]'],
  bouncingBall: [
    '( ●    )',
    '(  ●   )',
    '(   ●  )',
    '(    ● )',
    '(     ●)',
    '(    ● )',
    '(   ●  )',
    '(  ●   )',
    '( ●    )',
    '(●     )',
  ],
};

export interface SpinnerProps {
  type?: SpinnerType;
  color?: string;
  interval?: number;
  message?: string;
}

export class Spinner extends HookedComponent<SpinnerProps> {
  private frameIndex = 0;
  private frames: string[];
  private lastLineLength = 0;

  constructor(terminal: Terminal, props: SpinnerProps) {
    super(terminal, props);
    this.frames = SPINNER_FRAMES[props.type || 'dots'];
  }

  protected override setupEffects(): void {
    const interval = this.props.interval || 80;

    this.useInterval(
      'spinner',
      () => {
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        this.render();
      },
      interval
    );
  }

  protected render(): void {
    const { color, message } = this.props;
    const frame = this.frames[this.frameIndex];

    // Clear previous line
    if (this.lastLineLength > 0) {
      this.terminal.eraseLine();
      this.terminal.column(0);
    }

    // Build output string
    let output = frame;
    if (message) {
      output += ` ${message}`;
    }

    // Apply color if specified
    if (color) {
      const colorMethod = (this.terminal as any)[color];
      if (colorMethod && typeof colorMethod === 'function') {
        colorMethod.call(this.terminal, output);
      } else {
        this.terminal(output);
      }
    } else {
      this.terminal(output);
    }

    this.lastLineLength = output?.length || 0;
  }

  public stop(): void {
    // Clear the spinner line
    if (this.lastLineLength > 0) {
      this.terminal.eraseLine();
      this.terminal.column(0);
    }

    this.unmount();
  }

  public succeed(message?: string): void {
    this.stop();
    this.terminal.green('✔');
    if (message) {
      this.terminal(` ${message}`);
    }
    this.terminal('\n');
  }

  public fail(message?: string): void {
    this.stop();
    this.terminal.red('✖');
    if (message) {
      this.terminal(` ${message}`);
    }
    this.terminal('\n');
  }

  public warn(message?: string): void {
    this.stop();
    this.terminal.yellow('⚠');
    if (message) {
      this.terminal(` ${message}`);
    }
    this.terminal('\n');
  }

  public info(message?: string): void {
    this.stop();
    this.terminal.blue('ℹ');
    if (message) {
      this.terminal(` ${message}`);
    }
    this.terminal('\n');
  }
}
