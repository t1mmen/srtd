import { describe, expect, it } from 'vitest';
import {
  createSpinner,
  renderBranding,
  renderResults,
  renderStatBadge,
  renderStatBadges,
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
});
