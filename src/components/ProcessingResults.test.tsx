import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import type { ProcessedTemplateResult } from '../types.js';
import { ProcessingResults } from './ProcessingResults.js';

describe('ProcessingResults', () => {
  it('should show skipped templates', () => {
    const result: ProcessedTemplateResult = {
      applied: [],
      errors: [],
      skipped: ['test1.sql', 'test2.sql'],
      built: [],
    };

    const { lastFrame } = render(<ProcessingResults result={result} />);

    expect(lastFrame()).toContain('Skipped');
    expect(lastFrame()).toContain('test1.sql');
    expect(lastFrame()).toContain('test2.sql');
  });

  it('should show built templates when templates are built', () => {
    const result: ProcessedTemplateResult = {
      applied: [],
      errors: [],
      skipped: [],
      built: ['test1.sql', 'test2.sql'],
    };

    const { lastFrame } = render(<ProcessingResults result={result} showBuild={true} />);

    expect(lastFrame()).toContain('Built');
    expect(lastFrame()).toContain('test1.sql');
    expect(lastFrame()).toContain('test2.sql');
  });

  it('should show applied templates when showApply is true', () => {
    const result: ProcessedTemplateResult = {
      applied: ['test1.sql', 'test2.sql'],
      errors: [],
      skipped: [],
      built: [],
    };

    const { lastFrame } = render(<ProcessingResults result={result} showApply={true} />);

    expect(lastFrame()).toContain('Applied');
    expect(lastFrame()).toContain('test1.sql');
    expect(lastFrame()).toContain('test2.sql');
  });

  it('should show errors when templates fail', () => {
    const result: ProcessedTemplateResult = {
      applied: [],
      errors: [
        { file: 'test1.sql', templateName: 'test1', error: 'Syntax error' },
        { file: 'test2.sql', templateName: 'test2', error: 'Connection failed' },
      ],
      skipped: [],
      built: [],
    };

    const { lastFrame } = render(<ProcessingResults result={result} />);

    expect(lastFrame()).toContain('Errors');
    expect(lastFrame()).toContain('test1: Syntax error');
    expect(lastFrame()).toContain('test2: Connection failed');
  });

  it('should show multiple result types together', () => {
    const result: ProcessedTemplateResult = {
      applied: ['applied.sql'],
      errors: [{ file: 'error.sql', templateName: 'error', error: 'Error message' }],
      skipped: ['skipped.sql'],
      built: ['built.sql'],
    };

    const { lastFrame } = render(
      <ProcessingResults result={result} showApply={true} showBuild={true} />
    );

    expect(lastFrame()).toContain('Applied');
    expect(lastFrame()).toContain('applied.sql');
    expect(lastFrame()).toContain('Built');
    expect(lastFrame()).toContain('built.sql');
    expect(lastFrame()).toContain('Skipped');
    expect(lastFrame()).toContain('skipped.sql');
    expect(lastFrame()).toContain('Errors');
    expect(lastFrame()).toContain('error: Error message');
  });
});
