/**
 * MultiSelect component for Terminal-Kit
 * Allows selecting multiple items from a list
 */

import type { Terminal } from 'terminal-kit';
import { HookedComponent } from '../hooks.js';

export interface MultiSelectItem<T = any> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface MultiSelectProps<T = any> {
  items: MultiSelectItem<T>[];
  onSubmit?: (items: MultiSelectItem<T>[]) => void;
  onHighlight?: (item: MultiSelectItem<T>) => void;
  initialSelected?: T[];
  indicatorComponent?: string;
  selectedIndicator?: string;
  unselectedIndicator?: string;
  itemComponent?: (item: MultiSelectItem<T>, isSelected: boolean, isHighlighted: boolean) => string;
  limit?: number;
  color?: string;
  highlightColor?: string;
  selectedColor?: string;
  disabledColor?: string;
}

export class MultiSelect<T = any> extends HookedComponent<MultiSelectProps<T>> {
  private highlightedIndex: number;
  private selectedValues: Set<T>;
  private scrollOffset = 0;
  private startY = 0;

  constructor(terminal: Terminal, props: MultiSelectProps<T>) {
    super(terminal, props);

    // Initialize selected values
    this.selectedValues = new Set(props.initialSelected || []);

    // Find first non-disabled item
    this.highlightedIndex = props.items.findIndex(item => !item.disabled);
    if (this.highlightedIndex === -1) this.highlightedIndex = 0;
  }

  protected override onMount(): void {
    super.onMount();
    this.startY = 0; // Terminal-Kit doesn't expose cursor position directly

    // Setup keyboard handlers
    this.terminal.on('key', this.handleKeyPress);

    // Initial highlight callback
    const highlightedItem = this.props.items[this.highlightedIndex];
    if (highlightedItem && this.props.onHighlight) {
      this.props.onHighlight(highlightedItem);
    }
  }

  protected override onUnmount(): void {
    this.terminal.off('key', this.handleKeyPress);
    super.onUnmount();
  }

  private handleKeyPress = (key: string): void => {
    switch (key) {
      case 'UP':
        this.moveHighlight(-1);
        break;
      case 'DOWN':
        this.moveHighlight(1);
        break;
      case ' ':
        this.toggleCurrentItem();
        break;
      case 'ENTER':
        this.submitSelection();
        break;
      case 'ESCAPE':
      case 'q':
        this.unmount();
        break;
    }
  };

  private moveHighlight(direction: number): void {
    const { items } = this.props;
    let newIndex = this.highlightedIndex;

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
      if (newIndex === this.highlightedIndex) {
        break;
      }
    } while (items[newIndex]?.disabled);

    if (newIndex !== this.highlightedIndex && !items[newIndex]?.disabled) {
      this.highlightedIndex = newIndex;

      // Update scroll offset if using limit
      if (this.props.limit) {
        if (this.highlightedIndex < this.scrollOffset) {
          this.scrollOffset = this.highlightedIndex;
        } else if (this.highlightedIndex >= this.scrollOffset + this.props.limit) {
          this.scrollOffset = this.highlightedIndex - this.props.limit + 1;
        }
      }

      // Call highlight callback
      const item = items[newIndex];
      if (item && this.props.onHighlight) {
        this.props.onHighlight(item);
      }

      this.render();
    }
  }

  private toggleCurrentItem(): void {
    const highlightedItem = this.props.items[this.highlightedIndex];
    if (highlightedItem && !highlightedItem.disabled) {
      if (this.selectedValues.has(highlightedItem.value)) {
        this.selectedValues.delete(highlightedItem.value);
      } else {
        this.selectedValues.add(highlightedItem.value);
      }
      this.render();
    }
  }

  private submitSelection(): void {
    const selectedItems = this.props.items.filter(item => this.selectedValues.has(item.value));

    if (this.props.onSubmit) {
      this.props.onSubmit(selectedItems);
      this.unmount();
    }
  }

  protected render(): void {
    const {
      items,
      indicatorComponent = '❯',
      selectedIndicator = '◉',
      unselectedIndicator = '◯',
      itemComponent,
      limit,
      color = 'white',
      highlightColor = 'cyan',
      selectedColor = 'green',
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
      const isHighlighted = actualIndex === this.highlightedIndex;
      const isSelected = this.selectedValues.has(item.value);
      const isDisabled = item.disabled || false;

      // Clear line first
      this.terminal.eraseLine();

      // Render selection indicator
      const selectionIcon = isSelected ? selectedIndicator : unselectedIndicator;
      if (isSelected) {
        (this.terminal as any)[selectedColor](selectionIcon + ' ');
      } else {
        this.terminal(selectionIcon + ' ');
      }

      // Render highlight indicator
      if (isHighlighted) {
        (this.terminal as any)[highlightColor](indicatorComponent + ' ');
      } else {
        this.terminal('  ');
      }

      // Render item
      let itemText: string;
      if (itemComponent) {
        itemText = itemComponent(item, isSelected, isHighlighted);
      } else {
        itemText = item.label;
      }

      // Apply color based on state
      if (isDisabled) {
        (this.terminal as any)[disabledColor](itemText);
      } else if (isHighlighted) {
        (this.terminal as any)[highlightColor](itemText);
      } else if (isSelected) {
        (this.terminal as any)[selectedColor](itemText);
      } else {
        (this.terminal as any)[color](itemText);
      }

      this.terminal('\n');
    });

    // Show scroll indicator if needed
    if (limit && this.scrollOffset + limit < items.length) {
      this.terminal.dim('↓ More items below\n');
    }

    // Show help text
    this.terminal('\n');
    this.terminal.dim('Space to select, Enter to submit, q to quit\n');
  }

  public getSelectedValues(): T[] {
    return Array.from(this.selectedValues);
  }

  public getSelectedItems(): MultiSelectItem<T>[] {
    return this.props.items.filter(item => this.selectedValues.has(item.value));
  }
}

/**
 * Convenience function to show a multi-select menu and get results
 */
export async function showMultiSelect<T>(
  terminal: Terminal,
  items: MultiSelectItem<T>[],
  options?: Omit<MultiSelectProps<T>, 'items' | 'onSubmit'>
): Promise<T[]> {
  return new Promise(resolve => {
    const multiSelect = new MultiSelect(terminal, {
      ...options,
      items,
      onSubmit: selectedItems => {
        resolve(selectedItems.map(item => item.value));
      },
    });

    multiSelect.mount();

    // Handle escape/cancel
    terminal.once('key', (key: string) => {
      if (key === 'ESCAPE') {
        multiSelect.unmount();
        resolve([]);
      }
    });
  });
}
