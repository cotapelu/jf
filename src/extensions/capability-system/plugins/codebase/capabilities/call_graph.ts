#!/usr/bin/env node
/**
 * codebase.call_graph capability
 *
 * Build call graph from one or more entry files, optionally following imports.
 * Supports filtering by callee name, depth limit, and result limit.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { resolve, dirname } from "path";
// import { fileURLToPath } from "url"; // unused removed
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// __filename unused
// __dirname unused

export const schema = Type.Object({
  file: Type.String({ description: "Primary entry file path (relative to cwd)" }),
  entryPoints: Type.Optional(Type.Array(Type.String(), { description: "Additional entry file paths for combined call graph" })),
  query: Type.Object({
    kind: Type.Optional(Type.Union(["call"], { description: "Node kind; currently only 'call' supported" })),
    name: Type.Optional(Type.String({ description: "Filter calls by callee name (exact or regex)" })),
    depth: Type.Optional(Type.Integer({ description: "Max traversal depth (0 = unlimited, default 1)" })),
    includeCrossFile: Type.Optional(Type.Boolean({ description: "Follow imports to include cross-file calls (default false)" })),
    limit: Type.Optional(Type.Integer({ description: "Max edges to return (default 50)" }))
  }, { additionalProperties: false })
}, { required: ["file"], additionalProperties: false });

interface CallGraphNode {
  kind: "function";
  name: string;
  file: string;
  line: number;
}

interface CallGraphEdge {
  from: CallGraphNode;
  to: CallGraphNode;
}

interface ParsedFile {
  fileAbs: string;     // absolute path
  fileRel: string;     // relative to cwd
  funcs: Map<string, CallGraphNode>; // key = fileRel:name
  imports: Map<string, { source: string; original: string }>; // local name -> { source, original }
  calls: Array<{ callerKey: string; calleeLocal: string }>;
}

function walk(node: any, visitor: (n: any, parent?: any) => void, parent?: any) {
  if (!node || typeof node !== 'object') return;
  // @ts-ignore
  node._parent = parent;
  visitor(node, parent);
  for (const key in node) {
    if (key === '_parent') continue;
    const child = node[key];
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) {
        child.forEach((c: any) => walk(c, visitor, node));
      } else {
        walk(child, visitor, node);
      }
    }
  }
}

function nameMatches(name: string, pattern?: string): boolean {
  if (!pattern) return true;
  try {
    const regex = new RegExp(pattern);
    return regex.test(name);
  } catch {
    return name === pattern;
  }
}

function handleFunctionNode(node: any, fileRel: string, funcs: Map<string, CallGraphNode>): void {
  let name: string | undefined;
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    name = node.id?.name;
  } else if (node.type === 'MethodDefinition') {
    name = node.key?.name || node.key?.value;
  }
  if (name) {
    const key = `${fileRel}:${name}`;
    funcs.set(key, { kind: 'function', name, file: fileRel, line: node.loc?.start?.line ?? 0 });
  }
}

function handleImportNode(node: any, imports: Map<string, { source: string; original: string }>): void {
  if (node.type === 'ImportDeclaration') {
    const source = node.source.value;
    for (const sp of node.specifiers) {
      const local = sp.local.name;
      const original = sp.imported?.name || sp.local.name;
      imports.set(local, { source, original });
    }
  }
}

function handleFunctionStackNode(node: any, fileRel: string, funcStack: string[]): void {
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'MethodDefinition') {
    let name: string | undefined;
    if (node.type === 'MethodDefinition') {
      name = node.key?.name || node.key?.value;
    } else {
      name = node.id?.name;
    }
    if (name) {
      const key = `${fileRel}:${name}`;
      funcStack.push(key);
    }
  }
}

function handleCallNode(node: any, funcStack: string[], calls: Array<{ callerKey: string; calleeLocal: string }>): void {
  if (node.type === 'CallExpression') {
    if (funcStack.length > 0) {
      const callee = node.callee;
      if (callee.type === 'Identifier') {
        calls.push({ callerKey: funcStack[funcStack.length - 1], calleeLocal: callee.name });
      }
    }
  }
}

async function parseFile(cwd: string, fileRel: string): Promise<ParsedFile | null> {
  const fileAbs = resolve(cwd, fileRel);
  try {
    await fs.access(fileAbs);
  } catch {
    return null;
  }

  let content: string;
  try {
    content = await fs.readFile(fileAbs, 'utf-8');
  } catch {
    return null;
  }

  let ast;
  try {
    const parser = require('@typescript-eslint/parser');
    const { parse } = parser;
    ast = parse(content, {
      sourceType: "module",
      ecmaVersion: "latest",
      ts: true,
      jsx: true,
      loc: true,
      range: false
    });
  } catch {
    return null;
  }

  const funcs = new Map<string, CallGraphNode>();
  const imports = new Map<string, { source: string; original: string }>();
  const calls: Array<{ callerKey: string; calleeLocal: string }> = [];

  // First pass: collect functions
  walk(ast, (node: any) => handleFunctionNode(node, fileRel, funcs));

  const funcStack: string[] = [];

  // Second pass: imports, function stack, calls
  walk(ast, (node: any) => {
    handleImportNode(node, imports);
    handleFunctionStackNode(node, fileRel, funcStack);
    handleCallNode(node, funcStack, calls);
  }, undefined);

  return { fileAbs, fileRel, funcs, imports, calls };
}

function resolveCallee(
  call: { callerKey: string; calleeLocal: string },
  callerPF: ParsedFile,
  imports: Map<string, { source: string; original: string }>,
  absToFuncs: Map<string, Map<string, CallGraphNode>>
): CallGraphNode | null {
  const imp = imports.get(call.calleeLocal);
  if (imp) {
    const callerDir = dirname(callerPF.fileAbs);
    const base = resolve(callerDir, imp.source);
    const candidates = [
      base,
      base + '.ts',
      base + '.tsx',
      base + '.js',
      base + '.jsx',
      resolve(base, 'index.ts'),
      resolve(base, 'index.js')
    ];
    for (const cand of candidates) {
      const funcs = absToFuncs.get(cand);
      if (funcs) {
        for (const node of funcs.values()) {
          if (node.name === imp.original) return node;
        }
      }
    }
    return null;
  } else {
    const localKey = `${callerPF.fileRel}:${call.calleeLocal}`;
    return callerPF.funcs.get(localKey) || null;
  }
}

async function collectAllFiles(cwd: string, roots: string[], depth: number, includeCrossFile: boolean): Promise<ParsedFile[]> {
  const visited = new Set<string>();
  const allFiles: ParsedFile[] = [];

  async function visitFile(fileRel: string, currentDepth: number): Promise<void> {
    const pf = await parseFile(cwd, fileRel);
    if (!pf) return;
    if (visited.has(pf.fileAbs)) return;
    visited.add(pf.fileAbs);
    allFiles.push(pf);

    if (includeCrossFile && currentDepth > 0) {
      const nextDepth = currentDepth - 1;
      for (const imp of pf.imports.values()) {
        const callerDir = dirname(pf.fileAbs);
        const base = resolve(callerDir, imp.source);
        const candidates = [
          base,
          base + '.ts',
          base + '.tsx',
          base + '.js',
          base + '.jsx',
          resolve(base, 'index.ts'),
          resolve(base, 'index.js')
        ];
        for (const cand of candidates) {
          try {
            await fs.access(cand);
            let rel = cand;
            if (cand.startsWith(cwd)) {
              rel = cand.slice(cwd.length + 1);
            }
            if (!visited.has(cand)) {
              await visitFile(rel, nextDepth);
            }
            break;
          } catch {
            // continue
          }
        }
      }
    }
  }

  for (const root of roots) {
    await visitFile(root, depth);
  }

  return allFiles;
}

function buildAbsToFuncs(allFiles: ParsedFile[]): Map<string, Map<string, CallGraphNode>> {
  const map = new Map<string, Map<string, CallGraphNode>>();
  for (const pf of allFiles) {
    map.set(pf.fileAbs, pf.funcs);
  }
  return map;
}

function buildEdges(
  allFiles: ParsedFile[],
  absToFuncs: Map<string, Map<string, CallGraphNode>>,
  nameFilter?: string,
  limit?: number
): CallGraphEdge[] {
  const edges: CallGraphEdge[] = [];
  for (const pf of allFiles) {
    for (const call of pf.calls) {
      const toNode = resolveCallee(call, pf, pf.imports, absToFuncs);
      if (toNode) {
        const fromNode = pf.funcs.get(call.callerKey);
        if (fromNode) {
          if (nameFilter && !nameMatches(toNode.name, nameFilter)) continue;
          edges.push({ from: fromNode, to: toNode });
        }
      }
    }
  }
  if (limit && edges.length > limit) {
    edges.length = limit;
  }
  return edges;
}

function collectUniqueNodes(allFiles: ParsedFile[], edges: CallGraphEdge[]): Map<string, CallGraphNode> {
  const nodeSet = new Map<string, CallGraphNode>();
  for (const pf of allFiles) {
    for (const node of pf.funcs.values()) {
      const key = `${node.file}:${node.name}`;
      if (!nodeSet.has(key)) nodeSet.set(key, node);
    }
  }
  for (const e of edges) {
    const k1 = `${e.from.file}:${e.from.name}`;
    const k2 = `${e.to.file}:${e.to.name}`;
    if (!nodeSet.has(k1)) nodeSet.set(k1, e.from);
    if (!nodeSet.has(k2)) nodeSet.set(k2, e.to);
  }
  return nodeSet;
}

function formatSummary(params: { file: string; entryPoints?: string[]; query: any }, result: { stats: { nodeCount: number; edgeCount: number } }, edges: CallGraphEdge[]): string {
  const { file, entryPoints, query } = params;
  const { depth = 1, includeCrossFile = false } = query;
  const name = query.name;
  const summary = `
📊 Call Graph: ${file}${entryPoints?.length ? ` + ${entryPoints.length} entryPoints` : ''}
🔍 Query: ${name ? `name="${name}"` : ''} ${depth !== undefined ? `depth=${depth}` : ''} ${includeCrossFile ? '+cross-file' : ''}
📈 Stats: ${result.stats.nodeCount} nodes, ${result.stats.edgeCount} edges

Edges (${edges.length}):
${edges.map((e, i) => `  ${i+1}. ${e.from.name} (${e.from.file}) → ${e.to.name} (${e.to.file})`).join('\n')}
`.trim();
  return summary;
}

function determineRoots(file: string, entryPoints?: string[]): string[] {
  const roots: string[] = [file];
  if (entryPoints && Array.isArray(entryPoints)) {
    for (const ep of entryPoints) {
      if (!roots.includes(ep)) roots.push(ep);
    }
  }
  return roots;
}

function buildResult(nodeSet: Map<string, CallGraphNode>, edges: CallGraphEdge[]): { nodes: CallGraphNode[]; edges: CallGraphEdge[]; stats: { nodeCount: number; edgeCount: number } } {
  return {
    nodes: Array.from(nodeSet.values()),
    edges,
    stats: { nodeCount: nodeSet.size, edgeCount: edges.length }
  };
}

/**
 * Builds a call graph from entry file(s), optionally following imports.
 * @param params - file, optional entryPoints, and query (depth, includeCrossFile, limit, name).
 * @param ctx - Context with cwd.
 * @returns Promise with call graph summary and details.
 */
export async function execute(params: { file: string; entryPoints?: string[]; query: any }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const { query = {} } = params;
  const { depth = 1, includeCrossFile = false, limit = 50 } = query;
  const nameFilter = query.name;

  const roots = determineRoots(params.file, params.entryPoints);
  const allFiles = await collectAllFiles(cwd, roots, depth, includeCrossFile);
  const absToFuncs = buildAbsToFuncs(allFiles);
  const edges = buildEdges(allFiles, absToFuncs, nameFilter, limit);
  const nodeSet = collectUniqueNodes(allFiles, edges);
  const result = buildResult(nodeSet, edges);
  const summary = formatSummary(params, result, edges);

  return {
    content: [{ type: "text" as const, text: summary }],
    details: { file: params.file, entryPoints: params.entryPoints, query, result },
    isError: false
  };
}

export default { execute, schema };
