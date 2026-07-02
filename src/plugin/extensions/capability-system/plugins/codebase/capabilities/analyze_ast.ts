#!/usr/bin/env node
/**
 * codebase.analyze_ast capability
 *
 * Deep analysis using @typescript-eslint/parser to extract accurate symbols,
 * imports, exports, and type information from TypeScript/JavaScript.
 *
 * More accurate than regex-based analyze but slower.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const schema = Type.Object({
  file: Type.String({ description: "File path to analyze (relative to cwd)" })
}, { required: ["file"], additionalProperties: false });

interface ImportInfo {
  moduleSpecifier: string;
  importClause?: string;
  namedImports?: string[];
  typeOnly?: boolean;
}

interface ExportInfo {
  type: "named" | "default" | "type" | "all";
  name?: string;
  aliases?: string[];
}

interface SymbolDef {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "enum" | "const" | "let";
  line: number;
  column?: number;
}

interface AnalysisResult {
  file: string;
  exists: boolean;
  language: "ts" | "tsx" | "js" | "jsx" | "unknown";
  lines: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: SymbolDef[];
  error?: string;
}

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

// Helper: add symbol if not duplicate
function addSymbol(result: AnalysisResult, symbol: SymbolDef) {
  const exists = result.symbols.some(s => s.name === symbol.name && s.kind === symbol.kind && s.line === symbol.line);
  if (!exists) result.symbols.push(symbol);
}

// Collector: Handle ImportDeclaration
function handleImport(node: any, result: AnalysisResult) {
  const specifier = node.source.value;
  const importInfo: ImportInfo = { moduleSpecifier: specifier };
  const named: string[] = [];
  let defaultImport: string | null = null;
  let namespace: string | null = null;
  node.specifiers.forEach((sp: any) => {
    if (sp.type === 'ImportSpecifier') {
      named.push(sp.local.name);
    } else if (sp.type === 'ImportDefaultSpecifier') {
      defaultImport = sp.local.name;
    } else if (sp.type === 'ImportNamespaceSpecifier') {
      namespace = sp.local.name;
    }
  });
  if (defaultImport) importInfo.importClause = defaultImport;
  if (namespace) importInfo.importClause = `* as ${namespace}`;
  if (named.length) importInfo.namedImports = named;
  if (node.importKind === 'type') importInfo.typeOnly = true;
  result.imports.push(importInfo);
}

// Collector: Handle ExportNamedDeclaration
function handleExportNamed(node: any, result: AnalysisResult) {
  if (node.declaration) {
    if (node.declaration.type === 'VariableDeclaration') {
      node.declaration.declarations.forEach((decl: any) => {
        result.exports.push({ type: "named", name: decl.id.name });
        addSymbol(result, { name: decl.id.name, kind: "variable", line: decl.loc.start.line });
      });
    } else if (node.declaration.type === 'FunctionDeclaration') {
      const name = node.declaration.id?.name || '<anonymous>';
      result.exports.push({ type: "named", name });
      addSymbol(result, { name, kind: "function", line: node.declaration.loc.start.line });
    } else if (node.declaration.type === 'ClassDeclaration') {
      const name = node.declaration.id?.name || '<anonymous>';
      result.exports.push({ type: "named", name });
      addSymbol(result, { name, kind: "class", line: node.declaration.loc.start.line });
    } else if (node.declaration.type === 'TSTypeAliasDeclaration') {
      const name = node.declaration.id.name;
      result.exports.push({ type: "named", name });
      addSymbol(result, { name, kind: "type", line: node.declaration.loc.start.line });
    } else if (node.declaration.type === 'TSInterfaceDeclaration') {
      const name = node.declaration.id.name;
      result.exports.push({ type: "named", name });
      addSymbol(result, { name, kind: "interface", line: node.declaration.loc.start.line });
    }
  } else if (node.specifiers) {
    node.specifiers.forEach((sp: any) => {
      if (sp.type === 'ExportSpecifier') {
        result.exports.push({ type: "named", name: sp.exported.name, aliases: sp.local.name !== sp.exported.name ? [sp.local.name] : undefined });
      }
    });
  }
}

// Collector: Handle ExportDefaultDeclaration
function handleExportDefault(node: any, result: AnalysisResult) {
  if (node.declaration) {
    const dec = node.declaration;
    let kind: SymbolDef['kind'] = 'variable';
    let name: string = '<anonymous>';
    if (dec.type === 'FunctionDeclaration') {
      kind = 'function';
      name = dec.id?.name || '<anonymous>';
    } else if (dec.type === 'ClassDeclaration') {
      kind = 'class';
      name = dec.id?.name || '<anonymous>';
    } else if (dec.type === 'Identifier') {
      name = dec.name;
    } else if (dec.type === 'CallExpression' || dec.type === 'ArrowFunctionExpression') {
      name = '<default function>';
      kind = 'function';
    }
    result.exports.push({ type: "default", name });
    if (name !== '<anonymous>' && name !== '<default function>') {
      addSymbol(result, { name, kind, line: dec.loc.start.line });
    }
  } else {
    result.exports.push({ type: "default", name: '<<unknown>>' });
  }
}

// Collector: Handle ExportAllDeclaration
function handleExportAll(_node: any, result: AnalysisResult) {
  result.exports.push({ type: "all" });
}

// Collector: Handle variable declarators (const/let/var)
function handleVariableDeclarator(node: any, parent: any, result: AnalysisResult) {
  if (node.id.type === 'Identifier') {
    const parentKind = parent?.kind as 'const' | 'let' | 'var' | undefined;
    let kind: SymbolDef['kind'] = 'variable';
    if (parentKind === 'const') kind = 'const';
    else if (parentKind === 'let') kind = 'let';
    else if (parentKind === 'var') kind = 'variable';
    addSymbol(result, { name: node.id.name, kind, line: node.loc.start.line, column: node.loc.start.column });
  }
}

// Main AST walk visitor
function handleFunctionDeclaration(node: any, result: AnalysisResult) {
  if (node.id) {
    addSymbol(result, { name: node.id.name, kind: "function", line: node.loc.start.line });
  }
}

function handleClassDeclaration(node: any, result: AnalysisResult) {
  if (node.id) {
    addSymbol(result, { name: node.id.name, kind: "class", line: node.loc.start.line });
  }
}

function handleTSTypeAlias(node: any, result: AnalysisResult) {
  if (node.id) {
    addSymbol(result, { name: node.id.name, kind: "type", line: node.loc.start.line });
  }
}

function handleTSInterface(node: any, result: AnalysisResult) {
  if (node.id) {
    addSymbol(result, { name: node.id.name, kind: "interface", line: node.loc.start.line });
  }
}

function handleTSEnum(node: any, result: AnalysisResult) {
  if (node.id) {
    addSymbol(result, { name: node.id.name, kind: "enum", line: node.loc.start.line });
  }
}

function createVisitor(result: AnalysisResult) {
  return (node: any, parent?: any) => {
    if (node.type === 'ImportDeclaration') return handleImport(node, result);
    if (node.type === 'ExportNamedDeclaration') return handleExportNamed(node, result);
    if (node.type === 'ExportDefaultDeclaration') return handleExportDefault(node, result);
    if (node.type === 'ExportAllDeclaration') return handleExportAll(node, result);
    if (node.type === 'FunctionDeclaration') return handleFunctionDeclaration(node, result);
    if (node.type === 'ClassDeclaration') return handleClassDeclaration(node, result);
    if (node.type === 'VariableDeclarator') return handleVariableDeclarator(node, parent, result);
    if (node.type === 'TSTypeAliasDeclaration') return handleTSTypeAlias(node, result);
    if (node.type === 'TSInterfaceDeclaration') return handleTSInterface(node, result);
    if (node.type === 'TSEnumDeclaration') return handleTSEnum(node, result);
  };
}

function detectLanguage(fileName: string): "ts" | "tsx" | "js" | "jsx" | "unknown" {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'ts') return 'ts';
  if (ext === 'tsx') return 'tsx';
  if (ext === 'js') return 'js';
  if (ext === 'jsx') return 'jsx';
  return "unknown";
}

function buildSummary(params: { file: string }, lines: number, language: string, result: AnalysisResult): string {
  return `
📄 File: ${params.file}
📏 Lines: ${lines}
🔤 Language: ${language}

📥 Imports (${result.imports.length}):
${result.imports.map((imp, i) => `  ${i+1}. ${imp.importClause ? `${imp.importClause  } ` : ''}from "${imp.moduleSpecifier}"`).join('\n')}

📤 Exports (${result.exports.length}):
${result.exports.map((exp, i) => `  ${i+1}. ${exp.type} ${exp.name || ''}${exp.aliases ? ` as ${  exp.aliases.join(', ')}` : ''}`).join('\n')}

🔧 Symbols (${result.symbols.length}):
${result.symbols.map((sym, i) => `  ${i+1}. ${sym.kind} ${sym.name} (line ${sym.line})`).join('\n')}
`.trim();
}

async function parseAST(content: string): Promise<any> {
  const parser = require('@typescript-eslint/parser');
  const { parse } = parser;
  return parse(content, {
    sourceType: "module",
    ecmaVersion: "latest",
    ts: true,
    jsx: true,
    range: false,
    loc: true
  });
}

async function executeInternal(filePath: string, file: string, language: "ts" | "tsx" | "js" | "jsx" | "unknown"): Promise<{ result: AnalysisResult; summary: string }> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split('\n').length;
  const result: AnalysisResult = {
    file,
    exists: true,
    language,
    lines,
    imports: [],
    exports: [],
    symbols: []
  };
  const ast = await parseAST(content);
  walk(ast, createVisitor(result));
  const summary = buildSummary({ file }, lines, language, result);
  return { result, summary };
}

export async function execute(params: { file: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const filePath = join(cwd, params.file);

  try { await fs.access(filePath); } catch {
    return { content: [{ type: "text" as const, text: `File not found: ${params.file}` }], isError: true, details: { file: params.file, exists: false } };
  }

  const language = detectLanguage(params.file);

  try {
    const { result, summary } = await executeInternal(filePath, params.file, language);
    return { content: [{ type: "text" as const, text: summary }], details: result, isError: false };
  } catch (err: any) {
    return { content: [{ type: "text" as const, text: `Parse error: ${err.message}` }], isError: true, details: { file: params.file, error: err.message } };
  }
}

export default { execute, schema };
