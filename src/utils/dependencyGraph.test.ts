import { describe, expect, it } from 'vitest';
import {
  buildDependencyGraph,
  detectCycles,
  type TemplateInput,
  topologicalSort,
} from './dependencyGraph.js';

describe('buildDependencyGraph', () => {
  it('builds graph from template files with no dependencies', () => {
    const templates: TemplateInput[] = [
      { path: 'tables/users.sql', content: 'CREATE TABLE users (id INT);' },
      { path: 'tables/posts.sql', content: 'CREATE TABLE posts (id INT);' },
    ];

    const graph = buildDependencyGraph(templates);

    expect(graph.get('tables/users.sql')).toEqual([]);
    expect(graph.get('tables/posts.sql')).toEqual([]);
  });

  it('builds graph with dependencies from FROM clause', () => {
    const templates: TemplateInput[] = [
      { path: 'tables/users.sql', content: 'CREATE TABLE users (id INT);' },
      {
        path: 'views/active.sql',
        content: 'CREATE VIEW active AS SELECT * FROM users WHERE active = true;',
      },
    ];

    const graph = buildDependencyGraph(templates);

    expect(graph.get('views/active.sql')).toContain('tables/users.sql');
    expect(graph.get('tables/users.sql')).toEqual([]);
  });

  it('builds graph with dependencies from REFERENCES', () => {
    const templates: TemplateInput[] = [
      { path: 'tables/users.sql', content: 'CREATE TABLE users (id INT);' },
      {
        path: 'tables/posts.sql',
        content: 'CREATE TABLE posts (id INT, user_id INT REFERENCES users(id));',
      },
    ];

    const graph = buildDependencyGraph(templates);

    expect(graph.get('tables/posts.sql')).toContain('tables/users.sql');
  });

  it('handles multiple dependencies from one template', () => {
    const templates: TemplateInput[] = [
      { path: 'tables/users.sql', content: 'CREATE TABLE users (id INT);' },
      { path: 'tables/posts.sql', content: 'CREATE TABLE posts (id INT);' },
      {
        path: 'views/stats.sql',
        content: 'CREATE VIEW stats AS SELECT * FROM users u JOIN posts p ON u.id = p.user_id;',
      },
    ];

    const graph = buildDependencyGraph(templates);
    const statsDeps = graph.get('views/stats.sql') || [];

    expect(statsDeps).toContain('tables/users.sql');
    expect(statsDeps).toContain('tables/posts.sql');
  });

  it('ignores references to objects not in template set', () => {
    const templates: TemplateInput[] = [
      {
        path: 'views/active.sql',
        content: 'CREATE VIEW active AS SELECT * FROM users WHERE active = true;',
      },
    ];

    const graph = buildDependencyGraph(templates);

    // users is referenced but not in templates, so no dependency
    expect(graph.get('views/active.sql')).toEqual([]);
  });
});

describe('topologicalSort', () => {
  it('returns templates in dependency order', () => {
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

  it('handles diamond dependencies', () => {
    // A depends on B and C, both B and C depend on D
    const graph = new Map([
      ['a.sql', ['b.sql', 'c.sql']],
      ['b.sql', ['d.sql']],
      ['c.sql', ['d.sql']],
      ['d.sql', []],
    ]);

    const sorted = topologicalSort(graph);

    expect(sorted.indexOf('d.sql')).toBeLessThan(sorted.indexOf('b.sql'));
    expect(sorted.indexOf('d.sql')).toBeLessThan(sorted.indexOf('c.sql'));
    expect(sorted.indexOf('b.sql')).toBeLessThan(sorted.indexOf('a.sql'));
    expect(sorted.indexOf('c.sql')).toBeLessThan(sorted.indexOf('a.sql'));
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
  it('returns empty array when no cycles exist', () => {
    const graph = new Map([
      ['a.sql', ['b.sql']],
      ['b.sql', ['c.sql']],
      ['c.sql', []],
    ]);

    expect(detectCycles(graph)).toEqual([]);
  });

  it('detects simple two-node cycle', () => {
    const graph = new Map([
      ['a.sql', ['b.sql']],
      ['b.sql', ['a.sql']],
    ]);

    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('detects three-node cycle', () => {
    const graph = new Map([
      ['a.sql', ['b.sql']],
      ['b.sql', ['c.sql']],
      ['c.sql', ['a.sql']],
    ]);

    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
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

  it('returns empty for disconnected acyclic components', () => {
    const graph = new Map([
      ['a.sql', ['b.sql']],
      ['b.sql', []],
      ['c.sql', ['d.sql']],
      ['d.sql', []],
    ]);

    expect(detectCycles(graph)).toEqual([]);
  });
});
