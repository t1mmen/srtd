/**
 * Box component for Terminal-Kit
 * Replaces Ink's Box component
 */

import type { Terminal } from 'terminal-kit';
import { AbstractComponent } from '../AbstractComponent.js';

export type BorderStyle = 'single' | 'double' | 'round' | 'bold' | 'none';

export interface BoxProps {
  width?: number;
  height?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  borderStyle?: BorderStyle;
  borderColor?: string;
  backgroundColor?: string;
  title?: string;
  children?: () => void;
}

const BORDER_CHARS = {
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
  },
  round: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
  },
  bold: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
  },
  none: {
    topLeft: ' ',
    topRight: ' ',
    bottomLeft: ' ',
    bottomRight: ' ',
    horizontal: ' ',
    vertical: ' ',
  },
};

export class Box extends AbstractComponent<BoxProps> {
  private startX = 0;
  private startY = 0;

  constructor(terminal: Terminal, props: BoxProps) {
    super(terminal, props);
  }

  protected render(): void {
    const {
      width = this.terminal.width,
      height = 3,
      paddingTop = 0,
      paddingBottom: _paddingBottom = 0,
      paddingLeft = 0,
      paddingRight: _paddingRight = 0,
      padding = 0,
      marginTop = 0,
      marginBottom: _marginBottom = 0,
      marginLeft = 0,
      marginRight: _marginRight = 0,
      margin = 0,
      borderStyle = 'single',
      borderColor,
      backgroundColor,
      title,
      children,
    } = this.props;

    // Calculate actual padding and margin
    const actualPaddingTop = paddingTop || padding;
    // const _actualPaddingBottom = paddingBottom || padding;
    const actualPaddingLeft = paddingLeft || padding;
    // const _actualPaddingRight = paddingRight || padding;
    const actualMarginTop = marginTop || margin;
    const actualMarginLeft = marginLeft || margin;

    // Get border characters
    const chars = BORDER_CHARS[borderStyle];

    // Store current position (Terminal-Kit doesn't expose cursor position directly)
    this.startX = 0;
    this.startY = 0;

    // Apply margin
    if (actualMarginTop > 0) {
      this.terminal.moveTo(this.startX, this.startY + actualMarginTop);
    }
    if (actualMarginLeft > 0) {
      this.terminal.moveTo(this.startX + actualMarginLeft, this.startY + actualMarginTop);
    }

    // Store box start position after margins
    const boxStartX = this.startX + actualMarginLeft;
    const boxStartY = this.startY + actualMarginTop;

    // Apply border color if specified
    const drawWithColor = (text: string) => {
      if (borderColor) {
        const colorMethod = (this.terminal as any)[borderColor];
        if (colorMethod && typeof colorMethod === 'function') {
          colorMethod.call(this.terminal, text);
        } else {
          this.terminal(text);
        }
      } else {
        this.terminal(text);
      }
    };

    // Draw top border
    if (borderStyle !== 'none') {
      drawWithColor(chars.topLeft);

      // Add title if provided
      if (title) {
        drawWithColor(`${chars.horizontal} ${title} `);
        const titleLength = title.length + 4;
        drawWithColor(chars.horizontal.repeat(Math.max(0, width - titleLength - 2)));
      } else {
        drawWithColor(chars.horizontal.repeat(width - 2));
      }

      drawWithColor(chars.topRight);
      this.terminal('\n');
    }

    // Draw middle section with padding
    const contentHeight = height - (borderStyle !== 'none' ? 2 : 0);

    for (let i = 0; i < contentHeight; i++) {
      this.terminal.moveTo(boxStartX, boxStartY + i + (borderStyle !== 'none' ? 1 : 0));

      if (borderStyle !== 'none') {
        drawWithColor(chars.vertical);
      }

      // Apply background color for content area
      if (backgroundColor) {
        const bgMethod = (this.terminal as any)[
          `bg${backgroundColor.charAt(0).toUpperCase()}${backgroundColor.slice(1)}`
        ];
        if (bgMethod && typeof bgMethod === 'function') {
          bgMethod.call(this.terminal, ' '.repeat(width - (borderStyle !== 'none' ? 2 : 0)));
        }
      } else {
        this.terminal(' '.repeat(width - (borderStyle !== 'none' ? 2 : 0)));
      }

      if (borderStyle !== 'none') {
        drawWithColor(chars.vertical);
      }
    }

    // Draw bottom border
    if (borderStyle !== 'none') {
      this.terminal.moveTo(boxStartX, boxStartY + height - 1);
      drawWithColor(chars.bottomLeft);
      drawWithColor(chars.horizontal.repeat(width - 2));
      drawWithColor(chars.bottomRight);
    }

    // Position cursor for content
    if (children) {
      const contentX = boxStartX + (borderStyle !== 'none' ? 1 : 0) + actualPaddingLeft;
      const contentY = boxStartY + (borderStyle !== 'none' ? 1 : 0) + actualPaddingTop;
      this.terminal.moveTo(contentX, contentY);

      // Call children to render content
      children();
    }

    // Move cursor to after the box
    this.terminal.moveTo(boxStartX, boxStartY + height);
  }
}
