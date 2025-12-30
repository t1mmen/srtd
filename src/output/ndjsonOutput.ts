import type { TemplateResult } from '../ui/types.js';

/**
 * Event types for NDJSON streaming output in watch mode.
 * Note: These are watch-specific events, not a 1:1 mapping to OrchestratorEvents.
 * - 'init' and 'error' are synthetic events created by watch command
 * - 'templateChanged', 'templateApplied', 'templateError' map to Orchestrator events
 */
export type StreamEventType =
  | 'init'
  | 'templateChanged'
  | 'templateApplied'
  | 'templateError'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: string;
  data: TemplateResult | TemplateResult[] | Record<string, unknown>;
}

export function ndjsonEvent(
  type: StreamEventType,
  data: TemplateResult | TemplateResult[] | Record<string, unknown>
): void {
  const event: StreamEvent = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
  process.stdout.write(`${JSON.stringify(event)}\n`);
}
