/**
 * Text component for Terminal-Kit
 * Replaces Ink's Text component
 */

import type { Terminal } from 'terminal-kit';
import { AbstractComponent } from '../AbstractComponent.js';

export interface TextProps {
  children?: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
  inverse?: boolean;
  strikethrough?: boolean;
}

export class Text extends AbstractComponent<TextProps> {
  constructor(terminal: Terminal, props: TextProps) {
    super(terminal, props);
  }

  protected render(): void {
    const {
      children = '',
      color,
      backgroundColor,
      bold,
      italic,
      underline,
      dim,
      inverse,
      strikethrough,
    } = this.props;

    if (!children) return;

    // Build style chain
    let output = this.terminal;

    // Apply color
    if (color) {
      const colorMethod = (output as any)[color];
      if (colorMethod && typeof colorMethod === 'function') {
        output = colorMethod.bind(output);
      }
    }

    // Apply background color
    if (backgroundColor) {
      const bgMethod = (output as any)[
        `bg${backgroundColor.charAt(0).toUpperCase()}${backgroundColor.slice(1)}`
      ];
      if (bgMethod && typeof bgMethod === 'function') {
        output = bgMethod.bind(output);
      }
    }

    // Apply text styles
    if (bold) output = output.bold;
    if (italic) output = output.italic;
    if (underline) output = output.underline;
    if (dim) output = output.dim;
    if (inverse) output = output.inverse;
    if (strikethrough) output = output.strike;

    // Write the text
    output(children);
  }
}

/**
 * Convenience function for inline text
 */
export function renderText(
  terminal: Terminal,
  text: string,
  props?: Omit<TextProps, 'children'>
): void {
  const textComponent = new Text(terminal, { ...props, children: text });
  textComponent.mount();
}
