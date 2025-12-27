import { describe, expect, it } from 'vitest';
import { isWipTemplate } from './isWipTemplate.js';

describe('isWipTemplate', () => {
  const WIP_INDICATOR = '.wip';

  it('should identify WIP templates correctly', () => {
    expect(isWipTemplate('file.wip.sql', WIP_INDICATOR)).toBe(true);
    expect(isWipTemplate('template.wip.sql', WIP_INDICATOR)).toBe(true);
    expect(isWipTemplate('path/to/file.wip.sql', WIP_INDICATOR)).toBe(true);
    expect(isWipTemplate('.wip.sql', WIP_INDICATOR)).toBe(true);
    expect(isWipTemplate('file.wip.', WIP_INDICATOR)).toBe(true);
  });

  it('should identify non-WIP templates correctly', () => {
    expect(isWipTemplate('file.sql', WIP_INDICATOR)).toBe(false);
    expect(isWipTemplate('wip-file.sql', WIP_INDICATOR)).toBe(false);
    expect(isWipTemplate('file-wip.sql', WIP_INDICATOR)).toBe(false);
    expect(isWipTemplate('wip.sql', WIP_INDICATOR)).toBe(false);
    expect(isWipTemplate('file-wip-sql', WIP_INDICATOR)).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isWipTemplate('file.wi.sql', WIP_INDICATOR)).toBe(false);
    // Note: .wipp contains .wip as a substring, so this matches
    // This is expected behavior - use a more specific indicator like '.wip.' if needed
    expect(isWipTemplate('file.wipp.sql', WIP_INDICATOR)).toBe(true);
  });

  it('should work with custom WIP indicators', () => {
    expect(isWipTemplate('file.draft.sql', '.draft')).toBe(true);
    expect(isWipTemplate('file.wip.sql', '.draft')).toBe(false);
    expect(isWipTemplate('file_WIP_test.sql', '_WIP_')).toBe(true);
  });
});
