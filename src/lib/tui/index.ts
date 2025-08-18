/**
 * Terminal-Kit UI abstraction layer
 * Main export file for the TUI framework
 */

export { AbstractComponent, FunctionalComponent } from './AbstractComponent.js';
export type { ComponentProps, ComponentState } from './AbstractComponent.js';

export { TerminalApp, render } from './TerminalApp.js';
export type { AppOptions } from './TerminalApp.js';

export {
  StateManager,
  EffectManager,
  TimerManager,
  HookedComponent,
} from './hooks.js';

// Export all components
export * from './components/index.js';

// Re-export terminal-kit types we use
export type { Terminal } from 'terminal-kit';
