#!/usr/bin/env node
/**
 * codebase.dependency_tree capability
 *
 * Builds a module dependency graph for TypeScript/JavaScript files.
 * Detects cycles, computes per-file exports/imports, and provides reachable analysis from entry points.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple AST walker
function walk(node: any, visitor: (n: any, parent?: any) => void, parent?: any) {
  if (!node || typeof node !== 'object') return;
  visitor(node, parent);
  for (const key in node) {
    if (node[key] && typeof node[key] === 'object') {
      if (Array.isArray(node[key])) {
        node[key].forEach((child: any) => walk(child, visitor, node));
      } else {
        walk(node[key], visitor, node);
      }
    }
  }
}

// Parse a file to extract imports and exports
interface FileModuleInfo {
  file: string;
  exports: string[];   // exported symbol names (including 'default' if present)
  imports: Map<string, string[]>; // source file path -> array of imported binding names
}

function processDeclaration(node: any, exports: string[]): void {
  if (!node.declaration) return;
  if (node.declaration.type === 'VariableDeclaration') {
    const decls = node.declaration.declarations || [];
    decls.forEach((d: any) => {
      if (d.id && d.id.type === 'Identifier') {
        exports.push(d.id.name);
      }
    });
  } else if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
    exports.push(node.declaration.id.name);
  } else if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
    exports.push(node.declaration.id.name);
  }
}

function processExportSpecifiers(node: any, exports: string[]): void {
  if (node.specifiers) {
    node.specifiers.forEach((spec: any) => {
      if (spec.exported) {
        const name = spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.name;
        exports.push(name);
      }
    });
  }
}

function processReimport(node: any, imports: Map<string, string[]>): void {
  if (!node.source) return;
  const src = node.source.value;
  const importedSymbols: string[] = [];
  if (node.specifiers) {
    node.specifiers.forEach((spec: any) => {
      if (spec.local) {
        const name = spec.local.type === 'Identifier' ? spec.local.name : spec.local.name;
        importedSymbols.push(name);
      }
    });
  } else {
    importedSymbols.push('*'); // wildcard re-export
  }
  imports.set(src, (imports.get(src) || []).concat(importedSymbols));
}

function handleExportNamedDeclaration(node: any, exports: string[], imports: Map<string, string[]>): void {
  processDeclaration(node, exports);
  processExportSpecifiers(node, exports);
  if (node.source) {
    processReimport(node, imports);
  }
}

function handleExportDefaultDeclaration(_node: any, exports: string[]): void {
  exports.push('default');
}

function handleExportAllDeclaration(node: any, imports: Map<string, string[]>): void {
  if (node.source) {
    const src = node.source.value;
    imports.set(src, (imports.get(src) || []).concat(['*']));
  }
}

function handleImportDeclaration(node: any, imports: Map<string, string[]>): void {
  const src = node.source.value;
  const imported: string[] = [];
  if (node.specifiers) {
    node.specifiers.forEach((spec: any) => {
      if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
        if (spec.imported) {
          const name = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.name;
          imported.push(name);
        } else if (spec.type === 'ImportDefaultSpecifier') {
          imported.push('default');
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          imported.push('*');
        }
      }
    });
  }
  imports.set(src, (imports.get(src) || []).concat(imported));
}

async function parseModule(filePath: string, source: string): Promise<FileModuleInfo> {
  const parser = require('@typescript-eslint/parser');
  const { parse } = parser;

  let ast;
  try {
    ast = parse(source, { sourceType: "module", ecmaVersion: "latest", ts: true, jsx: true });
  } catch (err: any) {
    throw new Error(`Parse error in ${filePath}: ${err.message}`);
  }

  const exports: string[] = [];
  const imports: Map<string, string[]> = new Map();

  walk(ast, (node: any) => {
    if (node.type === 'ExportNamedDeclaration') {
      handleExportNamedDeclaration(node, exports, imports);
    } else if (node.type === 'ExportDefaultDeclaration') {
      handleExportDefaultDeclaration(node, exports);
    } else if (node.type === 'ExportAllDeclaration') {
      handleExportAllDeclaration(node, imports);
    } else if (node.type === 'ImportDeclaration') {
      handleImportDeclaration(node, imports);
    }
  });

  return { file: filePath, exports, imports };
}

// Resolve a module specifier to a file path within the provided set of files.
function resolveInAllFiles(specifier: string, referrer: string, allFiles: Set<string>): string | null {
  // Skip external packages (node_modules or non-relative)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }
  const refDir = dirname(referrer);
  const base = resolve(refDir, specifier);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
  for (const ext of extensions) {
    const candidate = base + ext;
    if (allFiles.has(candidate)) return candidate;
  }
  // If the specifier itself is an absolute path present in allFiles
  if (allFiles.has(specifier)) return specifier;
  // Also try resolving the specifier as is relative to cwd (if it's absolute)
  if (allFiles.has(resolve(specifier))) return resolve(specifier);
  return null;
}

// Build the dependency graph
interface NodeInfo {
  id: string;
  file: string;
  exports: Set<string>;
  imports: Map<string, string[]>; // resolved target file -> symbols
  incoming: Set<string>; // set of file IDs that depend on this
}

interface GraphResult {
  nodes: Array<{ id: string; file: string; exports: string[]; imports: string[] }>;
  edges: Array<{ from: string; to: string; symbols: string[] }>;
  cycles: string[][];
  summary: {
    totalFiles: number;
    totalEdges: number;
    cycleCount: number;
  };
}

function createNodes(fileInfos: FileModuleInfo[]): Map<string, NodeInfo> {
  const nodes = new Map<string, NodeInfo>();
  for (const info of fileInfos) {
    const id = info.file;
    nodes.set(id, {
      id,
      file: info.file,
      exports: new Set(info.exports),
      imports: new Map(),
      incoming: new Set()
    });
  }
  return nodes;
}

function processFileImports(info: FileModuleInfo, nodes: Map<string, NodeInfo>, allFiles: Set<string>): void {
  const fromId = info.file;
  const fromNode = nodes.get(fromId);
  if (!fromNode) return;

  for (const [srcSpecifier, symbols] of info.imports) {
    let targetId: string | null = null;
    if (srcSpecifier.startsWith('.') || srcSpecifier.startsWith('/')) {
      const resolved = resolveInAllFiles(srcSpecifier, info.file, allFiles);
      if (resolved) targetId = resolved;
    } else {
      continue;
    }
    if (targetId && nodes.has(targetId)) {
      fromNode.imports.set(targetId, symbols);
      const toNode = nodes.get(targetId)!;
      toNode.incoming.add(fromId);
    }
  }
}

function resolveImports(nodes: Map<string, NodeInfo>, fileInfos: FileModuleInfo[], allFiles: Set<string>): void {
  for (const info of fileInfos) {
    processFileImports(info, nodes, allFiles);
  }
}

function buildEdgesArray(nodes: Map<string, NodeInfo>): Array<{ from: string; to: string; symbols: string[] }> {
  const edges: Array<{ from: string; to: string; symbols: string[] }> = [];
  for (const [fromId, node] of nodes) {
    for (const [toId, symbols] of node.imports) {
      edges.push({ from: fromId, to: toId, symbols });
    }
  }
  return edges;
}

function detectCycles(nodes: Map<string, NodeInfo>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfsDetectCycle(nodeId, nodes, visited, stack, onStack, cycles);
    }
  }
  return cycles;
}

function dfsDetectCycle(nodeId: string, nodes: Map<string, NodeInfo>, visited: Set<string>, stack: string[], onStack: Set<string>, cycles: string[][]): void {
  visited.add(nodeId);
  stack.push(nodeId);
  onStack.add(nodeId);

  const node = nodes.get(nodeId)!;
  for (const [toId] of node.imports) {
    if (!visited.has(toId)) {
      dfsDetectCycle(toId, nodes, visited, stack, onStack, cycles);
    } else if (onStack.has(toId)) {
      const start = stack.indexOf(toId);
      if (start !== -1) {
        const cycle = stack.slice(start).concat(toId);
        cycles.push(cycle);
      }
    }
  }

  stack.pop();
  onStack.delete(nodeId);
}

function deduplicateCycles(cycles: string[][]): string[][] {
  const uniqueCycles: string[][] = [];
  const cycleKeys = new Set<string>();
  for (const cycle of cycles) {
    const sorted = cycle.slice(0, -1).sort();
    const key = sorted.join('|');
    if (!cycleKeys.has(key)) {
      cycleKeys.add(key);
      uniqueCycles.push(cycle);
    }
  }
  return uniqueCycles;
}

function bfs(startNodes: Set<string>, nodes: Map<string, NodeInfo>): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = Array.from(startNodes);
  for (const node of startNodes) reachable.add(node);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curNode = nodes.get(cur);
    if (curNode) {
      for (const [next] of curNode.imports) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
  }
  return reachable;
}

function computeReachable(nodes: Map<string, NodeInfo>, entryPoints?: string[]): Set<string> {
  if (entryPoints && entryPoints.length > 0) {
    const entrySet = new Set(entryPoints.filter(p => nodes.has(p)));
    return bfs(entrySet, nodes);
  }
  return new Set(nodes.keys());
}

function filterNodes(nodes: Map<string, NodeInfo>, reachable: Set<string>): Map<string, NodeInfo> {
  const filtered = new Map<string, NodeInfo>();
  for (const [id, node] of nodes) {
    if (reachable.has(id)) filtered.set(id, node);
  }
  return filtered;
}

function filterEdges(edges: Array<{ from: string; to: string; symbols: string[] }>, reachable: Set<string>): Array<{ from: string; to: string; symbols: string[] }> {
  return edges.filter(e => reachable.has(e.from) && reachable.has(e.to));
}

function filterCycles(cycles: string[][], reachable: Set<string>): string[][] {
  return cycles.filter(cycle => cycle.slice(0, -1).every(n => reachable.has(n)));
}

function buildGraph(fileInfos: FileModuleInfo[], allFiles: Set<string>, entryPoints?: string[]): GraphResult {
  const nodes = createNodes(fileInfos);
  resolveImports(nodes, fileInfos, allFiles);
  const edges = buildEdgesArray(nodes);
  let cycles = detectCycles(nodes);
  cycles = deduplicateCycles(cycles);
  const reachable = computeReachable(nodes, entryPoints);
  const filteredNodes = filterNodes(nodes, reachable);
  const filteredEdges = filterEdges(edges, reachable);
  const filteredCycles = filterCycles(cycles, reachable);
  return {
    nodes: Array.from(filteredNodes.values()).map(n => ({
      id: n.id,
      file: n.file,
      exports: Array.from(n.exports),
      imports: Array.from(n.imports.keys())
    })),
    edges: filteredEdges,
    cycles: filteredCycles,
    summary: { totalFiles: filteredNodes.size, totalEdges: filteredEdges.length, cycleCount: filteredCycles.length }
  };
}

export const schema = Type.Object({
  files: Type.Array(Type.String(), { description: "List of file paths to analyze (relative to cwd)" }),
  entryPoints: Type.Array(Type.String(), { description: "Optional subset of files to treat as entry points. If omitted, files with no incoming imports are considered entries.", optional: true })
});

async function readAndParseFiles(cwd: string, files: string[]): Promise<{ fileInfos: FileModuleInfo[]; allFiles: Set<string> }> {
  const fileInfos: FileModuleInfo[] = [];
  const allFiles = new Set<string>();

  for (const relPath of files) {
    const absPath = join(cwd, relPath);
    allFiles.add(absPath);
    try {
      const source = await fs.readFile(absPath, "utf-8");
      const info = await parseModule(absPath, source);
      fileInfos.push(info);
    } catch (err: any) {
      throw new Error(`Error processing file ${relPath}: ${err.message}`);
    }
  }
  return { fileInfos, allFiles };
}

function convertToRelative(cwd: string, absResult: GraphResult): GraphResult {
  return {
    nodes: absResult.nodes.map(n => ({
      id: relative(cwd, n.id),
      file: relative(cwd, n.file),
      exports: n.exports,
      imports: n.imports.map((imp: string) => relative(cwd, imp))
    })),
    edges: absResult.edges.map(e => ({
      from: relative(cwd, e.from),
      to: relative(cwd, e.to),
      symbols: e.symbols
    })),
    cycles: absResult.cycles.map(cycle => cycle.map(p => relative(cwd, p))),
    summary: absResult.summary
  };
}

export async function execute(params: { files: string[]; entryPoints?: string[] }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  if (!params.files || params.files.length === 0) {
    return { content: [{ type: "text" as const, text: "No files provided" }], isError: true, details: { error: "files required" } };
  }

  let parseResult: { fileInfos: FileModuleInfo[]; allFiles: Set<string> };
  try {
    parseResult = await readAndParseFiles(cwd, params.files);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    // Extract file from error message if possible, else use first file
    const fileMatch = message.match(/processing file (\S+)/);
    const file = fileMatch ? fileMatch[1] : params.files[0] || '';
    return { content: [{ type: "text" as const, text: message }], isError: true, details: { file, error: message } };
  }

  const { fileInfos, allFiles } = parseResult;
  const absEntryPoints = params.entryPoints?.map(p => join(cwd, p));
  const absResult = buildGraph(fileInfos, allFiles, absEntryPoints);
  const relResult = convertToRelative(cwd, absResult);
  const output = formatOutput(relResult, params.entryPoints || []);
  return { content: [{ type: "text" as const, text: output }], isError: false, details: relResult };
}

function formatOutput(g: GraphResult, entryPoints: string[]): string {
  let txt = `📦 Dependency Tree Analysis\n\n`;
  txt += `📊 Summary:\n`;
  txt += `   Files: ${g.summary.totalFiles}\n`;
  txt += `   Import edges: ${g.summary.totalEdges}\n`;
  txt += `   Cycles detected: ${g.summary.cycleCount}\n\n`;

  if (entryPoints.length > 0) {
    txt += `🚪 Entry Points: ${entryPoints.length}\n`;
    entryPoints.forEach(ep => txt += `   - ${ep}\n`);
    txt += '\n';
  }

  if (g.cycles.length > 0) {
    txt += `⚠️  Cycles:\n`;
    g.cycles.forEach((cycle, i) => {
      txt += `   Cycle ${i + 1}: ${cycle.join(' → ')}\n`;
    });
    txt += '\n';
  }

  txt += `📋 Nodes (${g.nodes.length}):\n`;
  g.nodes.forEach(n => {
    txt += `   ${n.file}\n`;
    txt += `     Exports: ${n.exports.join(', ') || '(none)'}\n`;
    txt += `     Imports from: ${n.imports.join(', ') || '(none)'}\n`;
  });

  txt += `\n🔗 Edges (${g.edges.length}):\n`;
  g.edges.forEach(e => {
    txt += `   ${e.from} → ${e.to} [${e.symbols.join(', ')}]\n`;
  });

  return txt;
}
