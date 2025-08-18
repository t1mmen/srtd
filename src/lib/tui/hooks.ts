/**
 * Hook-like utilities for Terminal-Kit components
 * Provides similar patterns to React hooks for state and effects
 */

import {
  AbstractComponent,
  type ComponentProps,
  type ComponentState,
} from './AbstractComponent.js';

/**
 * State manager for functional-style components
 */
export class StateManager {
  private states: Map<string, any> = new Map();
  private listeners: Map<string, Set<() => void>> = new Map();

  /**
   * Get or initialize state
   */
  public useState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    if (!this.states.has(key)) {
      this.states.set(key, initialValue);
      this.listeners.set(key, new Set());
    }

    const getValue = () => this.states.get(key) as T;

    const setValue = (value: T | ((prev: T) => T)) => {
      const currentValue = this.states.get(key);
      const newValue =
        typeof value === 'function' ? (value as (prev: T) => T)(currentValue) : value;

      if (newValue !== currentValue) {
        this.states.set(key, newValue);
        this.notifyListeners(key);
      }
    };

    return [getValue(), setValue];
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(key: string, listener: () => void): () => void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.add(listener);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Notify all listeners for a state key
   */
  private notifyListeners(key: string): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(listener => listener());
    }
  }

  /**
   * Clear all state
   */
  public clear(): void {
    this.states.clear();
    this.listeners.clear();
  }
}

/**
 * Effect manager for side effects
 */
export class EffectManager {
  private effects: Map<string, { cleanup?: () => void }> = new Map();

  /**
   * Register an effect (similar to useEffect)
   */
  public useEffect(key: string, effect: () => void | (() => void), _deps?: any[]): void {
    // Clean up previous effect
    const prev = this.effects.get(key);
    if (prev?.cleanup) {
      prev.cleanup();
    }

    // Run new effect
    const cleanup = effect();
    this.effects.set(key, {
      cleanup: typeof cleanup === 'function' ? cleanup : undefined,
    });
  }

  /**
   * Clean up all effects
   */
  public cleanup(): void {
    this.effects.forEach(effect => {
      if (effect.cleanup) {
        effect.cleanup();
      }
    });
    this.effects.clear();
  }
}

/**
 * Timer manager for intervals and timeouts
 */
export class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Set an interval (similar to setInterval but managed)
   */
  public setInterval(key: string, callback: () => void, ms: number): void {
    this.clearInterval(key);
    const timer = setInterval(callback, ms);
    this.timers.set(key, timer);
  }

  /**
   * Clear an interval
   */
  public clearInterval(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Set a timeout (similar to setTimeout but managed)
   */
  public setTimeout(key: string, callback: () => void, ms: number): void {
    this.clearTimeout(key);
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(key);
    }, ms);
    this.timers.set(key, timer);
  }

  /**
   * Clear a timeout
   */
  public clearTimeout(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Clear all timers
   */
  public clearAll(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

/**
 * Hook-enabled component base class
 */
export abstract class HookedComponent<
  P extends ComponentProps = ComponentProps,
  S extends ComponentState = ComponentState,
> extends AbstractComponent<P, S> {
  protected stateManager = new StateManager();
  protected effectManager = new EffectManager();
  protected timerManager = new TimerManager();

  protected override onMount(): void {
    super.onMount();
    // Run initial effects
    this.setupEffects();
  }

  protected override onUnmount(): void {
    super.onUnmount();
    // Clean up
    this.effectManager.cleanup();
    this.timerManager.clearAll();
    this.stateManager.clear();
  }

  /**
   * Override in subclasses to setup effects
   */
  protected setupEffects(): void {
    // Override in subclasses
  }

  /**
   * Use state hook
   */
  protected useState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    const [value, setValue] = this.stateManager.useState(key, initialValue);

    // Subscribe to changes and re-render
    this.stateManager.subscribe(key, () => {
      this.forceUpdate();
    });

    return [value, setValue];
  }

  /**
   * Use effect hook
   */
  protected useEffect(key: string, effect: () => void | (() => void), deps?: any[]): void {
    this.effectManager.useEffect(key, effect, deps);
  }

  /**
   * Use interval hook
   */
  protected useInterval(key: string, callback: () => void, ms: number): void {
    this.timerManager.setInterval(key, callback, ms);
  }

  /**
   * Use timeout hook
   */
  protected useTimeout(key: string, callback: () => void, ms: number): void {
    this.timerManager.setTimeout(key, callback, ms);
  }
}
