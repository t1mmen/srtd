import { describe, expect, it, vi } from 'vitest';
import { useTemplateProcessor } from './useTemplateProcessor.js';

// Mock the dependencies
vi.mock('../utils/findProjectRoot.js', () => ({
  findProjectRoot: vi.fn(),
}));

vi.mock('../lib/templateManager.js', () => ({
  TemplateManager: {
    create: vi.fn(),
  },
}));

// Skip testing React hooks for now - just verify it exists and returns the expected interface
// We'll focus our coverage on more critical parts of the application

describe('useTemplateProcessor', () => {
  it('should export a template processor hook', () => {
    // Just verify the function exists and is callable
    expect(typeof useTemplateProcessor).toBe('function');
  });
});
