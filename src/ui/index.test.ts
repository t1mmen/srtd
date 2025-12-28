import { describe, expect, it } from 'vitest';
import {
  createSpinner,
  DEFAULT_WATCH_SHORTCUTS,
  renderBranding,
  renderResults,
  renderStatBadge,
  renderStatBadges,
  renderWatchFooter,
  renderWatchLogEntry,
} from './index.js';

describe('ui index exports', () => {
  it('should export createSpinner', () => {
    expect(createSpinner).toBeTypeOf('function');
  });

  it('should export renderBranding', () => {
    expect(renderBranding).toBeTypeOf('function');
  });

  it('should export renderResults', () => {
    expect(renderResults).toBeTypeOf('function');
  });

  it('should export renderStatBadge', () => {
    expect(renderStatBadge).toBeTypeOf('function');
  });

  it('should export renderStatBadges', () => {
    expect(renderStatBadges).toBeTypeOf('function');
  });

  it('should export renderWatchLogEntry', () => {
    expect(renderWatchLogEntry).toBeTypeOf('function');
  });

  it('should export renderWatchFooter', () => {
    expect(renderWatchFooter).toBeTypeOf('function');
  });

  it('should export DEFAULT_WATCH_SHORTCUTS', () => {
    expect(DEFAULT_WATCH_SHORTCUTS).toBeTypeOf('object');
    expect(Array.isArray(DEFAULT_WATCH_SHORTCUTS)).toBe(true);
  });
});
