/**
 * StatusMessage component for Terminal-Kit
 * Shows colored status messages with icons
 */

import figures from 'figures';
import type { Terminal } from 'terminal-kit';
import { AbstractComponent } from '../AbstractComponent.js';

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface StatusMessageProps {
  type: StatusType;
  message: string;
  icon?: string;
  newline?: boolean;
}

const STATUS_CONFIGS: Record<StatusType, { color: string; defaultIcon: string }> = {
  success: { color: 'green', defaultIcon: figures.tick },
  error: { color: 'red', defaultIcon: figures.cross },
  warning: { color: 'yellow', defaultIcon: figures.warning },
  info: { color: 'cyan', defaultIcon: figures.info },
  loading: { color: 'yellow', defaultIcon: figures.ellipsis },
};

export class StatusMessage extends AbstractComponent<StatusMessageProps> {
  constructor(terminal: Terminal, props: StatusMessageProps) {
    super(terminal, props);
  }

  protected render(): void {
    const { type, message, icon, newline = true } = this.props;

    const config = STATUS_CONFIGS[type];
    const displayIcon = icon || config.defaultIcon;

    const colorMethod = (this.terminal as any)[config.color];
    if (colorMethod && typeof colorMethod === 'function') {
      colorMethod.call(this.terminal, `${displayIcon} ${message}`);
    } else {
      this.terminal(`${displayIcon} ${message}`);
    }

    if (newline) {
      this.terminal('\n');
    }
  }
}

/**
 * Convenience functions for different status types
 */
export function showSuccess(terminal: Terminal, message: string, icon?: string): void {
  const status = new StatusMessage(terminal, { type: 'success', message, icon });
  status.mount();
}

export function showError(terminal: Terminal, message: string, icon?: string): void {
  const status = new StatusMessage(terminal, { type: 'error', message, icon });
  status.mount();
}

export function showWarning(terminal: Terminal, message: string, icon?: string): void {
  const status = new StatusMessage(terminal, { type: 'warning', message, icon });
  status.mount();
}

export function showInfo(terminal: Terminal, message: string, icon?: string): void {
  const status = new StatusMessage(terminal, { type: 'info', message, icon });
  status.mount();
}

export function showLoading(terminal: Terminal, message: string, icon?: string): void {
  const status = new StatusMessage(terminal, { type: 'loading', message, icon });
  status.mount();
}
