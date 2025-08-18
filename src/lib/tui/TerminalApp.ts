/**
 * TerminalApp - Main application container for Terminal-Kit UI
 * Replaces Ink's render() function and provides app lifecycle management
 */

import { EventEmitter } from 'node:events';
import terminalKit from 'terminal-kit';
import type { Terminal } from 'terminal-kit';
import type { AbstractComponent } from './AbstractComponent.js';

export interface AppOptions {
  fullscreen?: boolean;
  mouse?: boolean;
  grabInput?: boolean;
}

export class TerminalApp extends EventEmitter {
  private terminal: Terminal;
  private rootComponent: AbstractComponent | null = null;
  private isRunning = false;
  private options: AppOptions;

  constructor(options: AppOptions = {}) {
    super();
    this.options = {
      fullscreen: false,
      mouse: false,
      grabInput: true,
      ...options,
    };

    // Initialize terminal
    this.terminal = terminalKit.terminal;
    this.setupTerminal();
  }

  private setupTerminal(): void {
    // Clear screen if fullscreen
    if (this.options.fullscreen) {
      this.terminal.clear();
      this.terminal.fullscreen(true);
    }

    // Enable mouse if requested
    if (this.options.mouse) {
      this.terminal.grabInput({ mouse: 'button' });
    } else if (this.options.grabInput) {
      this.terminal.grabInput(true);
    }

    // Setup exit handlers
    this.terminal.on('key', (key: string) => {
      if (key === 'CTRL_C' || key === 'ESCAPE') {
        this.exit();
      }
    });

    // Handle terminal resize
    process.on('SIGWINCH', () => {
      this.emit('resize', {
        width: this.terminal.width,
        height: this.terminal.height,
      });

      if (this.rootComponent) {
        this.rootComponent.forceUpdate();
      }
    });
  }

  /**
   * Mount a root component and start the app
   */
  public mount(ComponentClass: typeof AbstractComponent, props?: any): void {
    if (this.isRunning) {
      throw new Error('App is already running');
    }

    // Create and mount root component
    const RootClass = ComponentClass as any;
    this.rootComponent = new RootClass(this.terminal, props || {});
    this.rootComponent!.mount();
    this.isRunning = true;

    this.emit('start');
  }

  /**
   * Unmount the root component and clean up
   */
  public unmount(): void {
    if (this.rootComponent) {
      this.rootComponent.destroy();
      this.rootComponent = null;
    }

    this.isRunning = false;
    this.emit('stop');
  }

  /**
   * Exit the application
   */
  public exit(code = 0): void {
    this.unmount();

    // Restore terminal
    if (this.options.fullscreen) {
      this.terminal.fullscreen(false);
    }

    if (this.options.grabInput || this.options.mouse) {
      this.terminal.grabInput(false);
    }

    this.terminal.clear();
    this.terminal.processExit(code);
  }

  /**
   * Get the terminal instance
   */
  public getTerminal(): Terminal {
    return this.terminal;
  }

  /**
   * Wait for the app to exit (useful for CLI commands)
   */
  public async waitForExit(): Promise<void> {
    return new Promise(resolve => {
      this.once('stop', resolve);
    });
  }
}

/**
 * Convenience function to create and run an app
 */
export function render(
  ComponentClass: typeof AbstractComponent,
  props?: any,
  options?: AppOptions
): TerminalApp {
  const app = new TerminalApp(options);
  app.mount(ComponentClass, props);
  return app;
}
