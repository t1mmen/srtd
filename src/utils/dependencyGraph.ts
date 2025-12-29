/**
 * Dependency Graph Builder
 *
 * Builds a dependency graph from SQL templates and provides
 * topological sorting and cycle detection.
 */

import { extractDeclarations, extractReferences } from './dependencyParser.js';

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
 * Returns a Map where:
 * - Keys are template paths
 * - Values are arrays of template paths that the key depends on
 */
export function buildDependencyGraph(templates: TemplateInput[]): Map<string, string[]> {
  // First pass: build declaration name -> template path mapping
  const declarationToPath = new Map<string, string>();

  for (const template of templates) {
    const declarations = extractDeclarations(template.content);
    for (const decl of declarations) {
      declarationToPath.set(decl.name.toLowerCase(), template.path);
    }
  }

  // Second pass: build dependency graph
  const graph = new Map<string, string[]>();

  for (const template of templates) {
    const declarations = extractDeclarations(template.content);
    const references = extractReferences(template.content, declarations);

    const dependencies: string[] = [];
    for (const ref of references) {
      const depPath = declarationToPath.get(ref.toLowerCase());
      // Only add if the dependency is in our template set and not self
      if (depPath && depPath !== template.path && !dependencies.includes(depPath)) {
        dependencies.push(depPath);
      }
    }

    graph.set(template.path, dependencies);
  }

  return graph;
}

/**
 * Topologically sort templates based on dependencies
 *
 * Returns templates in an order where dependencies come before dependents.
 * Uses depth-first search for stable ordering.
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
 * representing the cycle (e.g., ['a.sql', 'b.sql'] means a -> b -> a).
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
