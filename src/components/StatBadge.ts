import type { Terminal } from 'terminal-kit';

export function renderStatBadge(
  terminal: Terminal,
  label: string,
  value: number,
  color: string
): void {
  // Map color names to terminal-kit background methods
  const bgColorMap: Record<string, string> = {
    red: 'bgRed',
    green: 'bgGreen',
    yellow: 'bgYellow',
    blue: 'bgBlue',
    magenta: 'bgMagenta',
    cyan: 'bgCyan',
    white: 'bgWhite',
    gray: 'bgGray',
    grey: 'bgGray',
  };

  const bgMethod = bgColorMap[color.toLowerCase()] || 'bgWhite';

  // Render badge with background color
  if ((terminal as any)[bgMethod]) {
    (terminal as any)[bgMethod].black(` ${label}: ${value} `);
  } else {
    terminal(` ${label}: ${value} `);
  }
}

export class StatBadge {
  static render(terminal: Terminal, label: string, value: number, color: string): void {
    renderStatBadge(terminal, label, value, color);
  }
}
