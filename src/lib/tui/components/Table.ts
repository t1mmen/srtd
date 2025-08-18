/**
 * Table component for Terminal-Kit
 * Displays data in a tabular format with proper alignment
 */

import type { Terminal } from 'terminal-kit';
import { AbstractComponent } from '../AbstractComponent.js';

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

export interface TableRow {
  [key: string]: string | number | boolean;
}

export interface TableProps {
  columns: TableColumn[];
  rows: TableRow[];
  headerColor?: string;
  borderColor?: string;
  showBorder?: boolean;
  compact?: boolean;
}

export class Table extends AbstractComponent<TableProps> {
  constructor(terminal: Terminal, props: TableProps) {
    super(terminal, props);
  }

  private calculateColumnWidths(): number[] {
    const { columns, rows } = this.props;

    return columns.map(column => {
      if (column.width) return column.width;

      // Calculate width based on content
      const headerWidth = column.title.length;
      const maxContentWidth = Math.max(...rows.map(row => String(row[column.key] || '').length));

      return Math.max(headerWidth, maxContentWidth, 8); // minimum width of 8
    });
  }

  private padText(
    text: string,
    width: number,
    align: 'left' | 'center' | 'right' = 'left'
  ): string {
    const truncated = text.length > width ? text.slice(0, width - 3) + '...' : text;

    switch (align) {
      case 'center':
        const leftPad = Math.floor((width - truncated.length) / 2);
        const rightPad = width - truncated.length - leftPad;
        return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad);
      case 'right':
        return truncated.padStart(width);
      default:
        return truncated.padEnd(width);
    }
  }

  private renderBorder(widths: number[], char = '-'): void {
    const { showBorder = true, borderColor = 'gray' } = this.props;

    if (!showBorder) return;

    const border = widths.map(width => char.repeat(width + 2)).join('+');
    const colorMethod = (this.terminal as any)[borderColor];

    if (colorMethod && typeof colorMethod === 'function') {
      colorMethod.call(this.terminal, '+' + border + '+\n');
    } else {
      this.terminal('+' + border + '+\n');
    }
  }

  private renderRow(data: Record<string, string>, widths: number[], isHeader = false): void {
    const { columns, headerColor = 'bold', showBorder = true, borderColor = 'gray' } = this.props;

    // Left border
    if (showBorder) {
      const colorMethod = (this.terminal as any)[borderColor];
      if (colorMethod && typeof colorMethod === 'function') {
        colorMethod.call(this.terminal, '|');
      } else {
        this.terminal('|');
      }
    }

    columns.forEach((column, index) => {
      const text = data[column.key] || '';
      const width = widths[index];
      const paddedText = width !== undefined ? this.padText(text, width, column.align) : text;

      // Apply color
      const output = ` ${paddedText} `;

      if (isHeader) {
        const headerColorMethod = (this.terminal as any)[headerColor];
        if (headerColorMethod && typeof headerColorMethod === 'function') {
          headerColorMethod.call(this.terminal, output);
        } else {
          this.terminal(output);
        }
      } else if (column.color) {
        const columnColorMethod = (this.terminal as any)[column.color];
        if (columnColorMethod && typeof columnColorMethod === 'function') {
          columnColorMethod.call(this.terminal, output);
        } else {
          this.terminal(output);
        }
      } else {
        this.terminal(output);
      }

      // Column separator
      if (showBorder) {
        const colorMethod = (this.terminal as any)[borderColor];
        if (colorMethod && typeof colorMethod === 'function') {
          colorMethod.call(this.terminal, '|');
        } else {
          this.terminal('|');
        }
      }
    });

    this.terminal('\n');
  }

  protected render(): void {
    const { columns, rows, compact = false } = this.props;

    if (columns.length === 0) return;

    const widths = this.calculateColumnWidths();

    // Top border
    if (!compact) {
      this.renderBorder(widths);
    }

    // Header
    const headerData = columns.reduce(
      (acc, column) => {
        acc[column.key] = column.title;
        return acc;
      },
      {} as Record<string, string>
    );

    this.renderRow(headerData, widths, true);

    // Header separator
    this.renderBorder(widths, compact ? '-' : '=');

    // Rows
    rows.forEach(row => {
      const rowData = columns.reduce(
        (acc, column) => {
          acc[column.key] = String(row[column.key] || '');
          return acc;
        },
        {} as Record<string, string>
      );

      this.renderRow(rowData, widths);
    });

    // Bottom border
    if (!compact) {
      this.renderBorder(widths);
    }
  }
}

/**
 * Convenience function to render a table
 */
export function renderTable(
  terminal: Terminal,
  columns: TableColumn[],
  rows: TableRow[],
  options?: Omit<TableProps, 'columns' | 'rows'>
): void {
  const table = new Table(terminal, { columns, rows, ...options });
  table.mount();
}
