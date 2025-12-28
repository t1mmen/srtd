import chalk from 'chalk';
import { formatTime } from '../utils/formatTime.js';
import { SEPARATOR } from './constants.js';

export interface HeaderOptions {
  subtitle: string;
  version: string;
  templateDir?: string;
  migrationDir?: string;
  dbConnected?: boolean;
  lastBuild?: Date;
  templateCount?: number;
  wipCount?: number;
  needsBuildCount?: number;
}

/**
 * Render the srtd header with grouped sections.
 */
export function renderHeader(options: HeaderOptions): void {
  const {
    subtitle,
    version,
    templateDir,
    migrationDir,
    dbConnected,
    lastBuild,
    templateCount,
    wipCount,
    needsBuildCount,
  } = options;

  // Line 1: Badge + subtitle + version
  const badge = chalk.bgGray.white('[srtd]');
  console.log(`${badge} ${subtitle} v${version}`);

  // Separator
  console.log(chalk.dim(SEPARATOR));

  // Line 2: Source -> Destination (if provided)
  if (templateDir && migrationDir) {
    console.log(`src: ${chalk.cyan(templateDir)}  \u2192  dest: ${chalk.cyan(migrationDir)}`);
  }

  // Line 3: DB status + last build
  const parts: string[] = [];
  if (dbConnected !== undefined) {
    const dot = dbConnected ? chalk.green('\u25cf') : chalk.yellow('\u25cf');
    const status = dbConnected ? 'connected' : 'disconnected';
    parts.push(`db: ${dot} ${status}`);
  }
  if (lastBuild) {
    parts.push(`last: ${formatTime.relative(lastBuild)}`);
  }
  if (parts.length > 0) {
    console.log(parts.join('                    '));
  }

  // Line 4: Template counts
  if (templateCount !== undefined) {
    const countParts: string[] = [`${templateCount} templates`];
    if (wipCount && wipCount > 0) {
      countParts.push(chalk.dim(`${wipCount} WIP`));
    }
    if (needsBuildCount && needsBuildCount > 0) {
      countParts.push(chalk.yellow(`${needsBuildCount} needs build`));
    }
    if (countParts.length > 1) {
      console.log(`${countParts[0]} (${countParts.slice(1).join(', ')})`);
    } else {
      console.log(countParts[0]);
    }
  }

  // Separator
  console.log(chalk.dim(SEPARATOR));
}
