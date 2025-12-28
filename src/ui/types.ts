/**
 * Unified UI types for SRTD.
 *
 * Single, consistent data model used across build, apply, and watch views.
 */

/**
 * Status of a template operation.
 * - 'success': Template was successfully applied to local DB
 * - 'built': Template was successfully built to migration file
 * - 'unchanged': Template has not changed since last operation
 * - 'error': Operation failed
 * - 'changed': Template file modified, pending apply (watch mode)
 * - 'needs-build': Template applied but not yet built to migration (watch mode)
 */
export type TemplateStatus =
  | 'success'
  | 'built'
  | 'unchanged'
  | 'error'
  | 'changed'
  | 'needs-build';

/**
 * Unified result for a template operation.
 * Used consistently across build, apply, and watch commands.
 */
export interface TemplateResult {
  /** Template filename or path */
  template: string;

  /** Status of the operation */
  status: TemplateStatus;

  /** Target of the operation: migration filename for build, "local db" for apply */
  target?: string;

  /** When the operation occurred */
  timestamp?: Date;

  /** Error message if status === 'error' */
  errorMessage?: string;

  /** SQL snippet for error context */
  errorSqlSnippet?: string;

  /** Column position for error caret */
  errorColumn?: number;

  /**
   * Override display text for status (e.g., "changed, applied" for stacked events).
   * Used in watch mode when multiple events occur on the same template.
   */
  displayOverride?: string;

  /**
   * True if this change invalidates a previous build.
   * Used to show "(build outdated)" annotation in watch mode.
   */
  buildOutdated?: boolean;
}

/**
 * Context for rendering results.
 * Determines which command invoked the renderer and any mode flags.
 */
export interface RenderContext {
  /** Which command is rendering */
  command: 'build' | 'apply' | 'watch';

  /** Whether the operation was forced (build --force) */
  forced?: boolean;
}

/**
 * Options for the unified results renderer.
 */
export interface RenderResultsOptions {
  /** Results to display */
  results: TemplateResult[];

  /** Render context */
  context: RenderContext;
}
