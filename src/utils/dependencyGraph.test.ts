import { describe, expect, it } from 'vitest';
import {
  buildDependencyGraph,
  detectCycles,
  type TemplateInput,
  topologicalSort,
} from './dependencyGraph.js';

describe('buildDependencyGraph', () => {
  it('builds graph from @depends-on comments', () => {
    const templates: TemplateInput[] = [
      { path: '/templates/a.sql', content: '-- @depends-on: b.sql\nCREATE ...' },
      { path: '/templates/b.sql', content: 'CREATE ...' },
    ];

    const graph = buildDependencyGraph(templates);

    expect(graph.get('/templates/a.sql')).toEqual(['/templates/b.sql']);
    expect(graph.get('/templates/b.sql')).toEqual([]);
  });

  it('resolves dependencies by filename matching', () => {
    const templates: TemplateInput[] = [
      { path: '/project/templates/complex.sql', content: '-- @depends-on: base.sql' },
      { path: '/project/templates/base.sql', content: '' },
    ];

    const graph = buildDependencyGraph(templates);

    expect(graph.get('/project/templates/complex.sql')).toEqual(['/project/templates/base.sql']);
  });

  it('ignores dependencies not in template set', () => {
    const templates: TemplateInput[] = [
      { path: '/templates/a.sql', content: '-- @depends-on: external.sql, b.sql' },
      { path: '/templates/b.sql', content: '' },
    ];

    const graph = buildDependencyGraph(templates);

    // external.sql is not in templates, so only b.sql is included
    expect(graph.get('/templates/a.sql')).toEqual(['/templates/b.sql']);
  });

  it('handles templates with no dependencies', () => {
    const templates: TemplateInput[] = [
      { path: '/a.sql', content: 'CREATE TABLE users (id INT);' },
      { path: '/b.sql', content: 'CREATE TABLE posts (id INT);' },
    ];

    const graph = buildDependencyGraph(templates);

    expect(graph.get('/a.sql')).toEqual([]);
    expect(graph.get('/b.sql')).toEqual([]);
  });

  it('handles empty template list', () => {
    const graph = buildDependencyGraph([]);
    expect(graph.size).toBe(0);
  });

  it('handles multiple comma-separated dependencies', () => {
    const templates: TemplateInput[] = [
      { path: '/c.sql', content: '-- @depends-on: a.sql, b.sql' },
      { path: '/a.sql', content: '' },
      { path: '/b.sql', content: '' },
    ];

    const graph = buildDependencyGraph(templates);
    const deps = graph.get('/c.sql') || [];

    expect(deps).toContain('/a.sql');
    expect(deps).toContain('/b.sql');
    expect(deps).toHaveLength(2);
  });

  it('handles multiple @depends-on comments', () => {
    const templates: TemplateInput[] = [
      {
        path: '/c.sql',
        content: '-- @depends-on: a.sql\n-- @depends-on: b.sql\nCREATE ...',
      },
      { path: '/a.sql', content: '' },
      { path: '/b.sql', content: '' },
    ];

    const graph = buildDependencyGraph(templates);
    const deps = graph.get('/c.sql') || [];

    expect(deps).toContain('/a.sql');
    expect(deps).toContain('/b.sql');
  });

  it('matches filenames case-insensitively', () => {
    const templates: TemplateInput[] = [
      { path: '/templates/A.sql', content: '-- @depends-on: B.SQL' },
      { path: '/templates/b.sql', content: '' },
    ];

    const graph = buildDependencyGraph(templates);

    expect(graph.get('/templates/A.sql')).toEqual(['/templates/b.sql']);
  });
});

describe('topologicalSort', () => {
  it('sorts templates so dependencies come first', () => {
    const templates: TemplateInput[] = [
      { path: '/c.sql', content: '-- @depends-on: b.sql' },
      { path: '/b.sql', content: '-- @depends-on: a.sql' },
      { path: '/a.sql', content: '' },
    ];

    const graph = buildDependencyGraph(templates);
    const sorted = topologicalSort(graph);

    expect(sorted.indexOf('/a.sql')).toBeLessThan(sorted.indexOf('/b.sql'));
    expect(sorted.indexOf('/b.sql')).toBeLessThan(sorted.indexOf('/c.sql'));
  });

  it('handles diamond dependencies', () => {
    const templates: TemplateInput[] = [
      { path: '/d.sql', content: '-- @depends-on: b.sql, c.sql' },
      { path: '/b.sql', content: '-- @depends-on: a.sql' },
      { path: '/c.sql', content: '-- @depends-on: a.sql' },
      { path: '/a.sql', content: '' },
    ];

    const graph = buildDependencyGraph(templates);
    const sorted = topologicalSort(graph);

    // a must come before b and c, which must come before d
    expect(sorted.indexOf('/a.sql')).toBeLessThan(sorted.indexOf('/b.sql'));
    expect(sorted.indexOf('/a.sql')).toBeLessThan(sorted.indexOf('/c.sql'));
    expect(sorted.indexOf('/b.sql')).toBeLessThan(sorted.indexOf('/d.sql'));
    expect(sorted.indexOf('/c.sql')).toBeLessThan(sorted.indexOf('/d.sql'));
  });

  it('preserves all templates in output', () => {
    const templates: TemplateInput[] = [
      { path: '/a.sql', content: '' },
      { path: '/b.sql', content: '-- @depends-on: a.sql' },
    ];

    const graph = buildDependencyGraph(templates);
    const sorted = topologicalSort(graph);

    expect(sorted).toHaveLength(2);
    expect(sorted).toContain('/a.sql');
    expect(sorted).toContain('/b.sql');
  });

  it('returns templates in dependency order with pre-built graph', () => {
    const graph = new Map([
      ['views/active.sql', ['tables/users.sql']],
      ['tables/users.sql', []],
    ]);

    const sorted = topologicalSort(graph);

    const usersIdx = sorted.indexOf('tables/users.sql');
    const activeIdx = sorted.indexOf('views/active.sql');
    expect(usersIdx).toBeLessThan(activeIdx);
  });

  it('handles multi-level dependencies', () => {
    const graph = new Map([
      ['level3.sql', ['level2.sql']],
      ['level2.sql', ['level1.sql']],
      ['level1.sql', []],
    ]);

    const sorted = topologicalSort(graph);

    expect(sorted.indexOf('level1.sql')).toBeLessThan(sorted.indexOf('level2.sql'));
    expect(sorted.indexOf('level2.sql')).toBeLessThan(sorted.indexOf('level3.sql'));
  });

  it('returns all templates even with no dependencies', () => {
    const graph = new Map([
      ['a.sql', []],
      ['b.sql', []],
      ['c.sql', []],
    ]);

    const sorted = topologicalSort(graph);

    expect(sorted).toHaveLength(3);
    expect(sorted).toContain('a.sql');
    expect(sorted).toContain('b.sql');
    expect(sorted).toContain('c.sql');
  });
});

describe('detectCycles', () => {
  it('detects simple circular dependency', () => {
    const templates: TemplateInput[] = [
      { path: '/a.sql', content: '-- @depends-on: b.sql' },
      { path: '/b.sql', content: '-- @depends-on: a.sql' },
    ];

    const graph = buildDependencyGraph(templates);
    const cycles = detectCycles(graph);

    expect(cycles.length).toBeGreaterThan(0);
    // Cycle should contain both files
    const cycle = cycles[0];
    expect(cycle).toContain('/a.sql');
    expect(cycle).toContain('/b.sql');
  });

  it('detects longer cycles', () => {
    const templates: TemplateInput[] = [
      { path: '/a.sql', content: '-- @depends-on: b.sql' },
      { path: '/b.sql', content: '-- @depends-on: c.sql' },
      { path: '/c.sql', content: '-- @depends-on: a.sql' },
    ];

    const graph = buildDependencyGraph(templates);
    const cycles = detectCycles(graph);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it('returns empty array when no cycles', () => {
    const templates: TemplateInput[] = [
      { path: '/a.sql', content: '' },
      { path: '/b.sql', content: '-- @depends-on: a.sql' },
    ];

    const graph = buildDependencyGraph(templates);
    const cycles = detectCycles(graph);

    expect(cycles).toEqual([]);
  });

  it('returns empty for disconnected acyclic components', () => {
    const graph = new Map([
      ['a.sql', ['b.sql']],
      ['b.sql', []],
      ['c.sql', ['d.sql']],
      ['d.sql', []],
    ]);

    expect(detectCycles(graph)).toEqual([]);
  });

  it('detects cycle in larger graph', () => {
    const graph = new Map([
      ['a.sql', ['b.sql']],
      ['b.sql', ['c.sql']],
      ['c.sql', ['d.sql']],
      ['d.sql', ['b.sql']], // cycle: b -> c -> d -> b
      ['e.sql', ['a.sql']], // not in cycle
    ]);

    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });
});
