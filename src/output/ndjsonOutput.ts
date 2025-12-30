import type { TemplateResult } from '../ui/types.js';

export type StreamEventType =
  | 'init'
  | 'templateChanged'
  | 'templateApplied'
  | 'templateError'
  | 'templateBuilt'
  | 'buildComplete'
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
