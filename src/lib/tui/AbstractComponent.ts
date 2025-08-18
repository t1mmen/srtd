/**
 * AbstractComponent - Base class for all Terminal-Kit UI components
 * Provides a consistent API similar to React components for easier migration
 */

import { EventEmitter } from 'node:events';
import type { Terminal } from 'terminal-kit';

export interface ComponentProps {
  [key: string]: any;
}

export interface ComponentState {
  [key: string]: any;
}

export abstract class AbstractComponent<
  P extends ComponentProps = ComponentProps,
  S extends ComponentState = ComponentState,
> extends EventEmitter {
  protected terminal: Terminal;
  protected props: P;
  protected state: S;
  protected children: AbstractComponent[] = [];
  protected parent: AbstractComponent | null = null;
  protected isMounted = false;
  protected isDestroyed = false;

  constructor(terminal: Terminal, props: P, initialState?: S) {
    super();
    this.terminal = terminal;
    this.props = { ...props };
    this.state = initialState || ({} as S);
  }

  /**
   * Lifecycle: Called when component is mounted
   */
  protected onMount(): void {
    // Override in subclasses
  }

  /**
   * Lifecycle: Called when component is unmounted
   */
  protected onUnmount(): void {
    // Override in subclasses
  }

  /**
   * Lifecycle: Called when props are updated
   */
  protected onPropsUpdate(_prevProps: P): void {
    // Override in subclasses
  }

  /**
   * Lifecycle: Called when state is updated
   */
  protected onStateUpdate(_prevState: S): void {
    // Override in subclasses
  }

  /**
   * Mount the component
   */
  public mount(): void {
    if (this.isMounted || this.isDestroyed) return;

    this.isMounted = true;
    this.onMount();
    this.render();

    // Mount children
    for (const child of this.children) {
      child.mount();
    }
  }

  /**
   * Unmount the component
   */
  public unmount(): void {
    if (!this.isMounted || this.isDestroyed) return;

    // Unmount children first
    for (const child of this.children) {
      child.unmount();
    }

    this.onUnmount();
    this.isMounted = false;
  }

  /**
   * Destroy the component and free resources
   */
  public destroy(): void {
    if (this.isDestroyed) return;

    this.unmount();
    this.removeAllListeners();
    this.children = [];
    this.parent = null;
    this.isDestroyed = true;
  }

  /**
   * Update component props
   */
  public setProps(newProps: Partial<P>): void {
    const prevProps = { ...this.props };
    this.props = { ...this.props, ...newProps };
    this.onPropsUpdate(prevProps);

    if (this.isMounted) {
      this.render();
    }
  }

  /**
   * Update component state (similar to React's setState)
   */
  protected setState(newState: Partial<S> | ((prevState: S) => Partial<S>)): void {
    const prevState = { ...this.state };

    if (typeof newState === 'function') {
      this.state = { ...this.state, ...newState(prevState) };
    } else {
      this.state = { ...this.state, ...newState };
    }

    this.onStateUpdate(prevState);

    if (this.isMounted) {
      this.render();
    }
  }

  /**
   * Add a child component
   */
  protected addChild(child: AbstractComponent): void {
    child.parent = this;
    this.children.push(child);

    if (this.isMounted) {
      child.mount();
    }
  }

  /**
   * Remove a child component
   */
  protected removeChild(child: AbstractComponent): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.unmount();
      child.parent = null;
      this.children.splice(index, 1);
    }
  }

  /**
   * Clear all children
   */
  protected clearChildren(): void {
    for (const child of this.children) {
      child.unmount();
      child.parent = null;
    }
    this.children = [];
  }

  /**
   * Force a re-render
   */
  public forceUpdate(): void {
    if (this.isMounted) {
      this.render();
    }
  }

  /**
   * Abstract render method - must be implemented by subclasses
   */
  protected abstract render(): void;
}

/**
 * Functional component wrapper for simpler components
 */
export class FunctionalComponent<
  P extends ComponentProps = ComponentProps,
> extends AbstractComponent<P, {}> {
  private renderFn: (terminal: Terminal, props: P) => void;

  constructor(terminal: Terminal, props: P, renderFn: (terminal: Terminal, props: P) => void) {
    super(terminal, props, {});
    this.renderFn = renderFn;
  }

  protected render(): void {
    this.renderFn(this.terminal, this.props);
  }
}
