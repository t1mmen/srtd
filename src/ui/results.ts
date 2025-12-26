import chalk from 'chalk';
import figures from 'figures';
import type { ProcessedTemplateResult } from '../types.js';
import { renderStatBadges } from './badge.js';

export interface ResultsOptions {
  showBuild?: boolean;
  showApply?: boolean;
}

/**
 * Renders a section of results (built, applied, skipped items).
 */
function renderSection(items: string[], label: string, variant: 'build' | 'apply' | 'skip'): void {
  if (items.length === 0) return;

  const icon =
    variant === 'build' ? figures.tick : variant === 'apply' ? figures.play : figures.pointerSmall;

  const maxItems = 30;
  const itemsToShow = items.slice(0, maxItems);
  const overflow = items.length > maxItems ? items.length - maxItems : 0;
  const colorFn = variant === 'skip' ? chalk.yellow : chalk.green;

  // Section label
  console.log(chalk.bold(`${label}:`));

  // Items
  for (const item of itemsToShow) {
    console.log(`  ${colorFn(`${icon} ${item}`)}`);
  }

  // Overflow indicator
  if (overflow > 0) {
    console.log(chalk.dim(`  ... and ${overflow} more`));
  }

  console.log();
}

/**
 * Renders processing results with sections and stat badges.
 * @see {@link ProcessedTemplateResult} - Result structure from Orchestrator
 */
export function renderResults(result: ProcessedTemplateResult, options: ResultsOptions = {}): void {
  const { showBuild = true, showApply = false } = options;

  console.log();

  // Render sections
  renderSection(result.skipped, 'Skipped', 'skip');

  if (showBuild) {
    renderSection(result.built, 'Built', 'build');
  }

  if (showApply) {
    renderSection(result.applied, 'Applied', 'apply');
  }

  // Render errors
  if (result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    for (const error of result.errors) {
      console.log(chalk.red(`  ${figures.cross} ${error.templateName}: ${error.error}`));
    }
    console.log();
  }

  // Render stat badges
  const badges = renderStatBadges([
    { label: 'Skipped', value: result.skipped.length, color: 'yellow' },
    { label: 'Errors', value: result.errors.length, color: 'red' },
    { label: 'Built', value: result.built.length, color: 'green' },
    { label: 'Applied', value: result.applied.length, color: 'green' },
  ]);

  if (badges) {
    console.log(badges);
    console.log();
  }
}
