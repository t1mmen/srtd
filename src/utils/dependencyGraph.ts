/**
 * Dependency Graph Builder
 *
 * Builds a dependency graph from SQL templates using @depends-on comments
 * and provides topological sorting and cycle detection.
 */

import * as path from 'node:path';
import { extractDependsOn } from './dependencyParser.js';

/**
 * Input template for dependency analysis
 */
export interface TemplateInput {
  path: string;
  content: string;
}

/**
 * Build a dependency graph from templates
 *
 * Uses @depends-on comments to determine dependencies.
 * Dependencies are matched by filename (basename) to full paths.
 *
 * Returns a Map where:
 * - Keys are template paths
 * - Values are arrays of template paths that the key depends on
 */
export function buildDependencyGraph(templates: TemplateInput[]): Map<string, string[]> {
  // Build filename -> full path mapping for resolution
  const filenameToPath = new Map<string, string>();
  for (const template of templates) {
    const filename = path.basename(template.path);
    filenameToPath.set(filename.toLowerCase(), template.path);
  }

  // Build dependency graph
  const graph = new Map<string, string[]>();

  for (const template of templates) {
    const declaredDeps = extractDependsOn(template.content);
    const resolvedDeps: string[] = [];

    for (const dep of declaredDeps) {
      const depPath = filenameToPath.get(dep.toLowerCase());
      // Only add if dependency exists in template set and isn't self
      if (depPath && depPath !== template.path && !resolvedDeps.includes(depPath)) {
        resolvedDeps.push(depPath);
      }
    }

    graph.set(template.path, resolvedDeps);
  }

  return graph;
}

/**
 * Topologically sort templates based on dependencies
 *
 * Returns templates in an order where dependencies come before dependents.
 * Uses depth-first search for stable ordering.
 *
 * Note: If cycles exist, returns a best-effort ordering.
 * Use detectCycles() first to warn users.
 */
export function topologicalSort(graph: Map<string, string[]>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(node: string): void {
    if (visited.has(node)) return;
    visited.add(node);

    // Visit all dependencies first
    const deps = graph.get(node) || [];
    for (const dep of deps) {
      visit(dep);
    }

    // Then add this node
    result.push(node);
  }

  // Visit all nodes
  for (const node of graph.keys()) {
    visit(node);
  }

  return result;
}

/**
 * Detect cycles in the dependency graph
 *
 * Returns an array of cycles found. Each cycle is an array of template paths
 * representing the cycle (e.g., ['/a.sql', '/b.sql'] means a -> b -> a).
 */
export function detectCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      // Found a cycle - extract it from the path
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      dfs(dep, [...path]);
    }

    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}
