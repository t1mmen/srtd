import chalk from 'chalk';

type BadgeColor = 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';

const bgColorMap: Record<BadgeColor, (text: string) => string> = {
  red: text => chalk.bgRed.black(text),
  green: text => chalk.bgGreen.black(text),
  yellow: text => chalk.bgYellow.black(text),
  blue: text => chalk.bgBlue.black(text),
  magenta: text => chalk.bgMagenta.black(text),
  cyan: text => chalk.bgCyan.black(text),
  white: text => chalk.bgWhite.black(text),
  gray: text => chalk.bgGray.black(text),
};

/**
 * Renders a colored stat badge inline.
 */
export function renderStatBadge(label: string, value: number, color: BadgeColor): string {
  const colorFn = bgColorMap[color] || bgColorMap.white;
  return colorFn(` ${label}: ${value} `);
}

/**
 * Renders multiple stat badges on a single line.
 */
export function renderStatBadges(
  stats: Array<{ label: string; value: number; color: BadgeColor }>
): string {
  return stats
    .filter(s => s.value > 0)
    .map(s => renderStatBadge(s.label, s.value, s.color))
    .join(' ');
}
