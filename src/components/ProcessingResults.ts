import figures from 'figures';
import type { Terminal } from 'terminal-kit';
import { AbstractComponent } from '../lib/tui/index.js';
import type { ProcessedTemplateResult } from '../types.js';
import { renderStatBadge } from './StatBadge.js';
import { COLOR_ERROR, COLOR_SKIP, COLOR_SUCCESS } from './customTheme.js';

interface ProcessingResultsProps {
  result: ProcessedTemplateResult;
  showBuild?: boolean;
  showApply?: boolean;
}

export class ProcessingResults extends AbstractComponent<ProcessingResultsProps> {
  constructor(terminal: Terminal, props: ProcessingResultsProps) {
    super(terminal, props);
  }

  private renderSection(items: string[], label: string, variant: 'build' | 'apply' | 'skip'): void {
    if (items.length === 0) return;

    const icon =
      variant === 'build'
        ? figures.tick
        : variant === 'apply'
          ? figures.play
          : figures.pointerSmall;

    const maxItems = 30;
    const itemsToShow = items.slice(0, maxItems);
    const overflow = items.length > maxItems ? items.length - maxItems : 0;
    const color = variant === 'skip' ? 'yellow' : 'green';

    // Section label
    this.terminal.bold(`${label}:\n`);

    // Items
    itemsToShow.forEach(item => {
      this.terminal('  ');
      (this.terminal as any)[color](`${icon} ${item}\n`);
    });

    // Overflow indicator
    if (overflow > 0) {
      this.terminal.dim(`  ... and ${overflow} more\n`);
    }

    this.terminal('\n');
  }

  protected render(): void {
    const { result, showBuild = true, showApply = false } = this.props;

    // Clear and start rendering
    this.terminal('\n');

    // Render sections
    this.renderSection(result.skipped, 'Skipped', 'skip');

    if (showBuild) {
      this.renderSection(result.built, 'Built', 'build');
    }

    if (showApply) {
      this.renderSection(result.applied, 'Applied', 'apply');
    }

    // Render errors
    if (result.errors.length > 0) {
      this.terminal.red('Errors:\n');
      result.errors.forEach(error => {
        this.terminal.red(`  ${figures.cross} ${error.templateName}: ${error.error}\n`);
      });
      this.terminal('\n');
    }

    // Render stat badges
    this.terminal('\n');

    if (result.skipped.length > 0) {
      renderStatBadge(this.terminal, 'Skipped', result.skipped.length, 'yellow');
      this.terminal(' ');
    }

    if (result.errors.length > 0) {
      renderStatBadge(this.terminal, 'Errors', result.errors.length, 'red');
      this.terminal(' ');
    }

    if (result.built.length > 0) {
      renderStatBadge(this.terminal, 'Built', result.built.length, 'green');
      this.terminal(' ');
    }

    if (result.applied.length > 0) {
      renderStatBadge(this.terminal, 'Applied', result.applied.length, 'green');
      this.terminal(' ');
    }

    this.terminal('\n\n');
  }
}

export function ProcessingResultsComponent(terminal: Terminal, props: ProcessingResultsProps) {
  const component = new ProcessingResults(terminal, props);
  component.mount();
  return component;
}
