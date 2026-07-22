#!/usr/bin/env node
/**
 * codebase.ast_query capability
 *
 * Query AST for specific nodes (functions, classes, calls, symbols) with filtering.
 */

import { Type } from "typebox";
import * as fsSync from "fs";
import path, { join } from "path";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";

// __filename and __dirname unused

export const schema = Type.Object({
  file: Type.String({ description: "File path to query (relative to cwd)" }),
  query: Type.Object({
    kind: Type.Union(["function", "class", "call", "symbol", "import", "export"], { description: "Node kind to find" }),
    name: Type.Optional(Type.String({ description: "Name filter (exact or regex pattern)" })),
    parent: Type.Optional(Type.String({ description: "Parent container name (e.g., class name)" })),
    limit: Type.Optional(Type.Number({ description: "Max results (default 50)" }))
  }, { required: ["kind"], additionalProperties: false })
}, { required: ["file", "query"], additionalProperties: false });

interface Match {
  kind: string;
  name?: string;
  line: number;
  column?: number;
  parent?: string;
}

// --- AST walking utility with parent pointer ---
function walk(node: any, visitor: (n: any, parent?: any) => void, parent?: any) {
  if (!node || typeof node !== 'object') return;
  // attach temporary parent pointer for upward traversal
  // @ts-ignore
  node._parent = parent;
  visitor(node, parent);
  for (const key in node) {
    if (key === '_parent') continue; // avoid infinite recursion
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

// --- name pattern matching ---
function nameMatches(name: string, pattern?: string): boolean {
  if (!pattern) return true;
  try {
    const regex = new RegExp(pattern);
    return regex.test(name);
  } catch {
    return name === pattern;
  }
}

// --- Kind-specific handlers (each returns a match info or null) ---
function handleFunction(node: any): { name?: string; kind: string } | null {
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    return { name: node.id?.name || (node.type === 'ArrowFunctionExpression' ? '<arrow>' : '<anonymous>'), kind: 'function' };
  }
  if (node.type === 'MethodDefinition') {
    return { name: node.key?.name || node.key?.value, kind: 'function' };
  }
  return null;
}

function handleClass(node: any): { name?: string; kind: string } | null {
  if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
    return { name: node.id?.name || '<anonymous>', kind: 'class' };
  }
  return null;
}

function handleCall(node: any): { name?: string; kind: string } | null {
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    let name: string | undefined;
    if (callee.type === 'Identifier') {
      name = callee.name;
    } else if (callee.type === 'MemberExpression') {
      name = callee.property?.name;
    }
    if (name) return { name, kind: 'call' };
  }
  return null;
}

function handleSymbol(node: any): { name?: string; kind: string } | null {
  if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') return { name: node.id.name, kind: 'variable' };
  if (node.type === 'FunctionDeclaration' && node.id) return { name: node.id.name, kind: 'function' };
  if (node.type === 'ClassDeclaration' && node.id) return { name: node.id.name, kind: 'class' };
  if (node.type === 'TSTypeAliasDeclaration' && node.id) return { name: node.id.name, kind: 'type' };
  if (node.type === 'TSInterfaceDeclaration' && node.id) return { name: node.id.name, kind: 'interface' };
  if (node.type === 'TSEnumDeclaration' && node.id) return { name: node.id.name, kind: 'enum' };
  return null;
}

function handleImport(node: any): { name?: string; kind: string } | null {
  if (node.type === 'ImportDeclaration') {
    return { name: node.source.value, kind: 'import' };
  }
  return null;
}

function handleExport(node: any): { name?: string; kind: string } | null {
  if (node.type === 'ExportNamedDeclaration') return handleExportNamed(node);
  if (node.type === 'ExportDefaultDeclaration') return { name: node.declaration?.id?.name || 'default', kind: 'export' };
  if (node.type === 'ExportAllDeclaration') return { name: '*', kind: 'export' };
  return null;
}

function handleExportNamed(node: any): { name: string; kind: 'export' } {
  let name: string;
  if (node.specifiers && node.specifiers.length > 0) {
    name = node.specifiers.map((sp: any) => sp.exported?.name || sp.local?.name).join(', ');
  } else if (node.declaration) {
    name = getExportNameFromDeclaration(node.declaration) || '<export>';
  } else {
    name = '<export>';
  }
  return { name, kind: 'export' };
}

function getExportNameFromDeclaration(dec: any): string | undefined {
  if (dec.type === 'VariableDeclaration') {
    return dec.declarations.map((d: any) => d.id?.name).filter(Boolean).join(', ');
  }
  if (dec.id) return dec.id.name;
  if (dec.type === 'TSTypeAliasDeclaration' && dec.id) return dec.id.name;
  if (dec.type === 'TSInterfaceDeclaration' && dec.id) return dec.id.name;
  if (dec.type === 'TSEnumDeclaration' && dec.id) return dec.id.name;
  return undefined;
}

const kindHandlers: Record<string, (node: any) => { name?: string; kind: string } | null> = {
  function: handleFunction,
  class: handleClass,
  call: handleCall,
  symbol: handleSymbol,
  import: handleImport,
  export: handleExport,
};

function getMatchInfo(node: any, kind: string): { name?: string; kind: string } | null {
  const handler = kindHandlers[kind];
  return handler ? handler(node) : null;
}

// --- Parent container resolution ---
function getParentContainer(node: any, directParent: any): any {
  if (node.type === 'MethodDefinition' && directParent?.type === 'ClassBody') {
    return directParent._parent; // climb to ClassDeclaration
  }
  return directParent;
}

function parentMatches(container: any, parentName: string): boolean {
  if (!container) return false;
  if (container.type === 'ClassDeclaration' || container.type === 'ClassExpression') {
    return container.id?.name === parentName;
  }
  if (container.type === 'FunctionDeclaration' || container.type === 'FunctionExpression' || container.type === 'ArrowFunctionExpression') {
    return container.id?.name === parentName;
  }
  return false;
}

// --- Main collection ---
function collectMatches(ast: any, query: any): Match[] {
  const { kind, name, parent: parentName, limit } = query;
  const maxResults = limit || 50;
  const matches: Match[] = [];
  const visitor = createCollectVisitor(kind, maxResults, matches, name, parentName);
  walk(ast, visitor);
  return matches;
}

function createCollectVisitor(kind: string, maxResults: number, matches: Match[], name?: string, parentName?: string) {
  let abort = false;
  return function visitor(node: any, directParent?: any) {
    if (abort) return;
    const matchInfo = getMatchInfo(node, kind);
    if (!matchInfo) return;
    const { name: nodeName, kind: nodeKind } = matchInfo;
    const line = node.loc?.start?.line ?? 0;
    const column = node.loc?.start?.column;
    const container = getParentContainer(node, directParent);
    if (parentName && !parentMatches(container, parentName)) return;
    if (nodeName && name && !nameMatches(nodeName, name)) return;
    matches.push({ kind: nodeKind, name: nodeName, line, column, parent: container?.id?.name });
    if (matches.length >= maxResults) abort = true;
  };
}

// --- Execute capability ---
async function parseAST(content: string): Promise<any> {
  // Run parser in a worker thread to avoid blocking the event loop on syntax errors
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const workerPath = path.join(__dirname, 'parserWorker.js');
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: { content } });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Parser timeout after 10000ms'));
    }, 10000);
    worker.on('message', (msg: any) => {
      clearTimeout(timeout);
      worker.terminate();
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.ast);
    });
    worker.on('error', (err) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(String(err)));
    });
    worker.on('exit', (code) => {
      if (code !== 0 && !timeout) {
        reject(new Error(`Parser worker exited with code ${code}`));
      }
    });
  });
}

function buildQuerySummary(query: any, file: string, matches: any[]): string {
  return `
🔍 Query: ${query.kind} ${query.name ? `name="${query.name}"` : ''} ${query.parent ? `in "${query.parent}"` : ''}
📄 File: ${file}
✅ Matches: ${matches.length}

${matches.map((m, i) => `  ${i+1}. ${m.kind} ${m.name || ''} (line ${m.line}${m.column !== undefined ? `, col ${m.column}` : ''}${m.parent ? ` in ${m.parent}` : ''})`).join('\n')}
`.trim();
}

function checkFileExists(filePath: string): boolean {
  try { fsSync.accessSync(filePath); return true; } catch { return false; }
}

function readFileContent(filePath: string): string {
  return fsSync.readFileSync(filePath, "utf-8");
}

function parseFileAST(content: string): any {
  try { return parseAST(content); }
  catch (err: any) { throw err; }
}

/**
 * Executes an AST query against a TypeScript/JavaScript file.
 * @param params - Object with file path (relative to cwd) and query.
 * @param ctx - Context with optional cwd.
 * @returns Promise with query results and summary.
 */
export async function execute(params: { file: string; query: any }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const filePath = join(cwd, params.file);
  if (!checkFileExists(filePath)) return { content: [{ type: "text" as const, text: `File not found: ${params.file}` }], isError: true, details: { file: params.file, exists: false } };
  const content = readFileContent(filePath);
  let ast;
  try { ast = await parseFileAST(content); } catch (err: any) { return { content: [{ type: "text" as const, text: `Parse error: ${err.message}` }], isError: true, details: { file: params.file, error: err.message } }; }
  const matches = collectMatches(ast, params.query);
  const summary = buildQuerySummary(params.query, params.file, matches);
  return { content: [{ type: "text" as const, text: summary }], details: { file: params.file, query: params.query, matches }, isError: false };
}

export default { execute, schema };
