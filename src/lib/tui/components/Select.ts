/**
 * Select component for Terminal-Kit
 * Replaces Ink's Select component
 */

import type { Terminal } from 'terminal-kit';
import { HookedComponent } from '../hooks.js';

export interface SelectItem<T = any> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface SelectProps<T = any> {
  items: SelectItem<T>[];
  onSelect?: (item: SelectItem<T>) => void;
  onHighlight?: (item: SelectItem<T>) => void;
  initialIndex?: number;
  indicatorComponent?: string;
  itemComponent?: (item: SelectItem<T>, isSelected: boolean) => string;
  limit?: number;
  color?: string;
  highlightColor?: string;
  disabledColor?: string;
}

export class Select<T = any> extends HookedComponent<SelectProps<T>> {
  private selectedIndex: number;
  private scrollOffset = 0;
  private startY = 0;

  constructor(terminal: Terminal, props: SelectProps<T>) {
    super(terminal, props);

    // Find first non-disabled item or use initial index
    if (props.initialIndex !== undefined) {
      this.selectedIndex = props.initialIndex;
    } else {
      this.selectedIndex = props.items.findIndex(item => !item.disabled);
      if (this.selectedIndex === -1) this.selectedIndex = 0;
    }
  }

  protected override onMount(): void {
    super.onMount();
    this.startY = this.terminal.cy || 0;

    // Setup keyboard handlers
    this.terminal.on('key', this.handleKeyPress);

    // Initial highlight callback
    const selectedItem = this.props.items[this.selectedIndex];
    if (selectedItem && this.props.onHighlight) {
      this.props.onHighlight(selectedItem);
    }
  }

  protected override onUnmount(): void {
    this.terminal.off('key', this.handleKeyPress);
    super.onUnmount();
  }

  private handleKeyPress = (key: string): void => {
    switch (key) {
      case 'UP':
        this.moveSelection(-1);
        break;
      case 'DOWN':
        this.moveSelection(1);
        break;
      case 'ENTER':
      case ' ':
        this.selectCurrentItem();
        break;
      case 'ESCAPE':
      case 'q':
        this.unmount();
        break;
    }
  };

  private moveSelection(direction: number): void {
    const { items } = this.props;
    let newIndex = this.selectedIndex;

    // Find next non-disabled item
    do {
      newIndex = newIndex + direction;

      // Wrap around
      if (newIndex < 0) {
        newIndex = items.length - 1;
      } else if (newIndex >= items.length) {
        newIndex = 0;
      }

      // Prevent infinite loop if all items are disabled
      if (newIndex === this.selectedIndex) {
        break;
      }
    } while (items[newIndex]?.disabled);

    if (newIndex !== this.selectedIndex && !items[newIndex]?.disabled) {
      this.selectedIndex = newIndex;

      // Update scroll offset if using limit
      if (this.props.limit) {
        if (this.selectedIndex < this.scrollOffset) {
          this.scrollOffset = this.selectedIndex;
        } else if (this.selectedIndex >= this.scrollOffset + this.props.limit) {
          this.scrollOffset = this.selectedIndex - this.props.limit + 1;
        }
      }

      // Call highlight callback
      if (this.props.onHighlight) {
        this.props.onHighlight(items[newIndex]);
      }

      this.render();
    }
  }

  private selectCurrentItem(): void {
    const selectedItem = this.props.items[this.selectedIndex];
    if (selectedItem && !selectedItem.disabled && this.props.onSelect) {
      this.props.onSelect(selectedItem);
      this.unmount();
    }
  }

  protected render(): void {
    const {
      items,
      indicatorComponent = '❯',
      itemComponent,
      limit,
      color = 'white',
      highlightColor = 'cyan',
      disabledColor = 'gray',
    } = this.props;

    // Calculate visible items
    const visibleItems = limit ? items.slice(this.scrollOffset, this.scrollOffset + limit) : items;

    const visibleStartIndex = limit ? this.scrollOffset : 0;

    // Clear previous render
    this.terminal.moveTo(1, this.startY);

    // Show scroll indicators if needed
    if (limit && this.scrollOffset > 0) {
      this.terminal.dim('↑ More items above\n');
    }

    // Render each visible item
    visibleItems.forEach((item, visibleIndex) => {
      const actualIndex = visibleStartIndex + visibleIndex;
      const isSelected = actualIndex === this.selectedIndex;
      const isDisabled = item.disabled || false;

      // Clear line first
      this.terminal.eraseLine();

      // Render indicator
      if (isSelected) {
        (this.terminal as any)[highlightColor](indicatorComponent + ' ');
      } else {
        this.terminal('  ');
      }

      // Render item
      let itemText: string;
      if (itemComponent) {
        itemText = itemComponent(item, isSelected);
      } else {
        itemText = item.label;
      }

      // Apply color based on state
      if (isDisabled) {
        (this.terminal as any)[disabledColor](itemText);
      } else if (isSelected) {
        (this.terminal as any)[highlightColor](itemText);
      } else {
        (this.terminal as any)[color](itemText);
      }

      this.terminal('\n');
    });

    // Show scroll indicator if needed
    if (limit && this.scrollOffset + limit < items.length) {
      this.terminal.dim('↓ More items below');
    }
  }
}

/**
 * Convenience function to show a select menu and get result
 */
export async function showSelect<T>(
  terminal: Terminal,
  items: SelectItem<T>[],
  options?: Omit<SelectProps<T>, 'items' | 'onSelect'>
): Promise<T | undefined> {
  return new Promise(resolve => {
    const select = new Select(terminal, {
      ...options,
      items,
      onSelect: item => {
        resolve(item.value);
      },
    });

    select.mount();

    // Handle escape/cancel
    terminal.once('key', (key: string) => {
      if (key === 'ESCAPE') {
        select.unmount();
        resolve(undefined);
      }
    });
  });
}
