/**
 * ProgressBar component for Terminal-Kit
 * Provides visual progress indication
 */

import type { Terminal } from 'terminal-kit';
import { AbstractComponent } from '../AbstractComponent.js';

export interface ProgressBarProps {
  value: number; // 0-100
  width?: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
  backgroundColor?: string;
  completeChar?: string;
  incompleteChar?: string;
}

export class ProgressBar extends AbstractComponent<ProgressBarProps> {
  constructor(terminal: Terminal, props: ProgressBarProps) {
    super(terminal, props);
  }

  protected render(): void {
    const {
      value,
      width = 30,
      label,
      showPercentage = true,
      color = 'cyan',
      backgroundColor = 'gray',
      completeChar = '█',
      incompleteChar = '░',
    } = this.props;

    // Clamp value between 0 and 100
    const progress = Math.max(0, Math.min(100, value));
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;

    // Clear line
    this.terminal.eraseLine();
    this.terminal.column(0);

    // Render label if provided
    if (label) {
      this.terminal(`${label} `);
    }

    // Render progress bar
    const colorMethod = (this.terminal as any)[color];
    const bgColorMethod = (this.terminal as any)[backgroundColor];

    if (colorMethod && typeof colorMethod === 'function') {
      colorMethod.call(this.terminal, completeChar.repeat(filled));
    } else {
      this.terminal(completeChar.repeat(filled));
    }

    if (bgColorMethod && typeof bgColorMethod === 'function') {
      bgColorMethod.call(this.terminal, incompleteChar.repeat(empty));
    } else {
      this.terminal(incompleteChar.repeat(empty));
    }

    // Render percentage if requested
    if (showPercentage) {
      this.terminal(` ${progress}%`);
    }
  }
}
