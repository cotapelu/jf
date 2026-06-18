#!/usr/bin/env node
/**
 * codebase.analyze capability
 *
 * Analyzes a TypeScript/JavaScript file to extract:
 * - Imports (external and internal)
 * - Exports (named, default, type)
 * - Defined symbols (functions, classes, interfaces, types, variables)
 * - File statistics (lines, language)
 *
 * Returns structured data for LLM consumption.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join } from "path";

export const schema = Type.Object({
  file: Type.String({ description: "File path to analyze (relative to cwd)" })
}, { required: ["file"], additionalProperties: false });

// Type guard for valid file extensions
function isCodeExtension(ext: string): ext is 'ts' | 'tsx' | 'js' | 'jsx' | 'json' {
  return ['ts', 'tsx', 'js', 'jsx', 'json'].includes(ext);
}

interface ImportInfo {
  moduleSpecifier: string;
  importClause?: string; // default, * as ns, { named }
  namedImports?: string[];
  typeOnly?: boolean;
}

interface ExportInfo {
  type: "named" | "default" | "type";
  name: string;
  aliases?: string[]; // export { foo as bar }
}

interface SymbolDef {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "enum" | "const" | "let";
  line: number;
  column?: number;
  signature?: string;
}

interface AnalysisResult {
  file: string;
  exists: boolean;
  language: "ts" | "tsx" | "js" | "jsx" | "json" | "unknown";
  lines: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: SymbolDef[];
  error?: string;
}

// Simple regex-based analyzer (lightweight, no external parser)
// This is a heuristic analyzer suitable for LLM context.

// Regex patterns for parsing
const IMPORT_DECL_REGEX = /^\s*import\s+(?:(\*)\s*as\s+(\w+)|({[\s\S]*?})|(\w+))\s*from\s*['"]([^'"]+)['"];?/;
const EXPORT_DECL_REGEX = /^\s*export\s+(?:(\*)\s*from\s*['"][^'"]+['"];?|({[\s\S]*?})|(\w+)(\s+as\s+(\w+))?|default\s+(\w+))/;
const FUNCTION_DECL_REGEX = /^\s*(?:async\s+)?function\s+(\w+)\s*\(/;
const CLASS_DECL_REGEX = /^\s*class\s+(\w+)/;
const INTERFACE_DECL_REGEX = /^\s*interface\s+(\w+)/;
const TYPE_DECL_REGEX = /^\s*type\s+(\w+)\s*=/;
const VAR_DECL_REGEX = /^\s*(?:const|let)\s+(\w+)\s*[=;]/;
const ENUM_DECL_REGEX = /^\s*enum\s+(\w+)/;

// Parsing helpers
function processNamedGroup(namedGroup: string): { importClause: string; namedImports: string[] } {
  const namedStr = namedGroup.slice(1, -1).trim();
  if (namedStr) {
    const parts = namedStr.split(',').map(p => p.trim());
    const namedImports = parts.map(p => {
      const [name, alias] = p.split(/\s+as\s+/);
      return alias || name;
    });
    return { importClause: `{ ${namedStr} }`, namedImports };
  }
  return { importClause: '', namedImports: [] };
}

function tryParseImport(line: string, lineNum: number, imports: ImportInfo[]): boolean {
  const importMatch = line.match(IMPORT_DECL_REGEX);
  if (importMatch) {
    const [_, starAs, namedGroup, defaultImport, moduleSpecifier] = importMatch;
    const importInfo: ImportInfo = { moduleSpecifier };
    if (starAs) {
      importInfo.importClause = `* as ${starAs}`;
    } else if (namedGroup) {
      const result = processNamedGroup(namedGroup);
      importInfo.importClause = result.importClause;
      importInfo.namedImports = result.namedImports;
    } else if (defaultImport) {
      importInfo.importClause = defaultImport;
    }
    imports.push(importInfo);
    return true;
  }
  return false;
}

function handleDefaultClassExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  const m = line.match(/^\s*export\s+default\s+class\s+(\w+)/);
  if (m) {
    symbols.push({ name: m[1], kind: "class", line: lineNum });
    exports.push({ type: "default", name: m[1] });
    return true;
  }
  return false;
}

function handleDefaultInterfaceExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  const m = line.match(/^\s*export\s+default\s+interface\s+(\w+)/);
  if (m) {
    symbols.push({ name: m[1], kind: "interface", line: lineNum });
    exports.push({ type: "default", name: m[1] });
    return true;
  }
  return false;
}

function handleDefaultTypeExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  const m = line.match(/^\s*export\s+default\s+type\s+(\w+)\s*=/);
  if (m) {
    symbols.push({ name: m[1], kind: "type", line: lineNum });
    exports.push({ type: "default", name: m[1] });
    return true;
  }
  return false;
}

function handleDefaultFunctionExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  const m = line.match(/^\s*export\s+default\s+function\s+(\w+)\s*\(/);
  if (m) {
    symbols.push({ name: m[1], kind: "function", line: lineNum });
    exports.push({ type: "default", name: m[1] });
    return true;
  }
  return false;
}

function handleDefaultVarExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  const m = line.match(/^\s*export\s+default\s+(const|let|var)\s+(\w+)/);
  if (m) {
    symbols.push({ name: m[2], kind: "variable", line: lineNum });
    exports.push({ type: "default", name: m[2] });
    return true;
  }
  return false;
}

function handleNamedTypeExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  const m = line.match(/^\s*export\s+type\s+(\w+)\s*=/);
  if (m) {
    symbols.push({ name: m[1], kind: "type", line: lineNum });
    exports.push({ type: "named", name: m[1] });
    return true;
  }
  return false;
}

function handleNamedInterfaceExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  const m = line.match(/^\s*export\s+interface\s+(\w+)/);
  if (m) {
    symbols.push({ name: m[1], kind: "interface", line: lineNum });
    exports.push({ type: "named", name: m[1] });
    return true;
  }
  return false;
}

function handleOtherExports(line: string, lineNum: number, exports: ExportInfo[], _symbols: SymbolDef[]): boolean {
  const exportMatch = line.match(EXPORT_DECL_REGEX);
  if (exportMatch) {
    const [_1, starFrom, namedGroup, exportName, asAlias1, aliasName, defaultName] = exportMatch;
    if (starFrom) {
      exports.push({ type: "named", name: "*" });
    } else if (namedGroup) {
      const namedStr = namedGroup.slice(1, -1).trim();
      if (namedStr) {
        const parts = namedStr.split(',').map(p => p.trim());
        parts.forEach(p => {
          const [name, alias] = p.split(/\s+as\s+/);
          exports.push({ type: "named", name, aliases: alias ? [alias] : undefined });
        });
      }
    } else if (exportName) {
      exports.push({ type: "named", name: exportName, ...(asAlias1 && aliasName ? { aliases: [aliasName] } : {}) });
    } else if (defaultName) {
      exports.push({ type: "default", name: defaultName });
    }
    return true;
  }
  return false;
}

function tryParseExport(line: string, lineNum: number, exports: ExportInfo[], symbols: SymbolDef[]): boolean {
  if (handleDefaultClassExport(line, lineNum, exports, symbols)) return true;
  if (handleDefaultInterfaceExport(line, lineNum, exports, symbols)) return true;
  if (handleDefaultTypeExport(line, lineNum, exports, symbols)) return true;
  if (handleDefaultFunctionExport(line, lineNum, exports, symbols)) return true;
  if (handleDefaultVarExport(line, lineNum, exports, symbols)) return true;
  if (handleNamedTypeExport(line, lineNum, exports, symbols)) return true;
  if (handleNamedInterfaceExport(line, lineNum, exports, symbols)) return true;
  if (handleOtherExports(line, lineNum, exports, symbols)) return true;
  return false;
}

function handleFunctionSymbol(line: string, lineNum: number, symbols: SymbolDef[]): boolean {
  const m = line.match(FUNCTION_DECL_REGEX);
  if (m) {
    symbols.push({ name: m[1], kind: "function", line: lineNum });
    return true;
  }
  return false;
}

function handleClassSymbol(line: string, lineNum: number, symbols: SymbolDef[]): boolean {
  const m = line.match(CLASS_DECL_REGEX);
  if (m) {
    symbols.push({ name: m[1], kind: "class", line: lineNum });
    return true;
  }
  return false;
}

function handleInterfaceSymbol(line: string, lineNum: number, symbols: SymbolDef[]): boolean {
  const m = line.match(INTERFACE_DECL_REGEX);
  if (m) {
    symbols.push({ name: m[1], kind: "interface", line: lineNum });
    return true;
  }
  return false;
}

function handleTypeSymbol(line: string, lineNum: number, symbols: SymbolDef[]): boolean {
  const m = line.match(TYPE_DECL_REGEX);
  if (m) {
    symbols.push({ name: m[1], kind: "type", line: lineNum });
    return true;
  }
  return false;
}

function handleVariableSymbol(line: string, lineNum: number, symbols: SymbolDef[]): boolean {
  const m = line.match(VAR_DECL_REGEX);
  if (m) {
    symbols.push({ name: m[1], kind: "variable", line: lineNum });
    return true;
  }
  return false;
}

function handleEnumSymbol(line: string, lineNum: number, symbols: SymbolDef[]): boolean {
  const m = line.match(ENUM_DECL_REGEX);
  if (m) {
    symbols.push({ name: m[1], kind: "enum", line: lineNum });
    return true;
  }
  return false;
}

function tryParseSymbol(line: string, lineNum: number, symbols: SymbolDef[]): boolean {
  if (handleFunctionSymbol(line, lineNum, symbols)) return true;
  if (handleClassSymbol(line, lineNum, symbols)) return true;
  if (handleInterfaceSymbol(line, lineNum, symbols)) return true;
  if (handleTypeSymbol(line, lineNum, symbols)) return true;
  if (handleVariableSymbol(line, lineNum, symbols)) return true;
  if (handleEnumSymbol(line, lineNum, symbols)) return true;
  return false;
}

function analyzeContent(content: string): { imports: ImportInfo[]; exports: ExportInfo[]; symbols: SymbolDef[] } {
  const lines = content.split('\n');
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const symbols: SymbolDef[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    if (tryParseImport(line, lineNum, imports)) continue;
    if (tryParseExport(line, lineNum, exports, symbols)) continue;
    if (tryParseSymbol(line, lineNum, symbols)) continue;
  }

  return { imports, exports, symbols };
}

function buildSummary(file: string, lines: number, language: string, imports: ImportInfo[], exports: ExportInfo[], symbols: SymbolDef[]): string {
  return `
📄 File: ${file}
📏 Lines: ${lines}
🔤 Language: ${language}

📥 Imports (${imports.length}):
${imports.map((imp, i) => `  ${i+1}. ${imp.importClause ? imp.importClause + ' ' : ''}from "${imp.moduleSpecifier}"`).join('\n')}

📤 Exports (${exports.length}):
${exports.map((exp, i) => `  ${i+1}. ${exp.type} ${exp.name}${exp.aliases ? ' as ' + exp.aliases.join(', ') : ''}`).join('\n')}

🔧 Symbols (${symbols.length}):
${symbols.map((sym, i) => `  ${i+1}. ${sym.kind} ${sym.name} (line ${sym.line})`).join('\n')}
`.trim();
}

async function analyzeFile(filePath: string, file: string): Promise<{ result: AnalysisResult; summary: string }> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split('\n').length;
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  const language = isCodeExtension(ext) ? ext : 'unknown';
  const { imports, exports, symbols } = analyzeContent(content);
  const result: AnalysisResult = {
    file,
    exists: true,
    language,
    lines,
    imports,
    exports,
    symbols
  };
  const summary = buildSummary(file, lines, language, imports, exports, symbols);
  return { result, summary };
}

export async function execute(params: { file: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const filePath = join(cwd, params.file);

  try { await fs.access(filePath); } catch {
    return { content: [{ type: "text" as const, text: `File not found: ${params.file}` }], isError: true, details: { file: params.file, exists: false } };
  }

  try {
    const { result, summary } = await analyzeFile(filePath, params.file);
    return { content: [{ type: "text" as const, text: summary }], details: result, isError: false };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { file: params.file, error: msg } };
  }
}

export default { execute, schema };
