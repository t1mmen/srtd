import { describe, expect, it } from 'vitest';
import {
  createSpinner,
  DEFAULT_WATCH_SHORTCUTS,
  renderBranding,
  renderErrorDisplay,
  renderResultRow,
  renderResultsTable,
  renderWatchFooter,
} from './index.js';

describe('ui index exports', () => {
  it('should export createSpinner', () => {
    expect(createSpinner).toBeTypeOf('function');
  });

  it('should export renderBranding', () => {
    expect(renderBranding).toBeTypeOf('function');
  });

  it('should export renderResultsTable', () => {
    expect(renderResultsTable).toBeTypeOf('function');
  });

  it('should export renderResultRow', () => {
    expect(renderResultRow).toBeTypeOf('function');
  });

  it('should export renderErrorDisplay', () => {
    expect(renderErrorDisplay).toBeTypeOf('function');
  });

  it('should export renderWatchFooter', () => {
    expect(renderWatchFooter).toBeTypeOf('function');
  });

  it('should export DEFAULT_WATCH_SHORTCUTS', () => {
    expect(DEFAULT_WATCH_SHORTCUTS).toBeTypeOf('object');
    expect(Array.isArray(DEFAULT_WATCH_SHORTCUTS)).toBe(true);
  });
});
