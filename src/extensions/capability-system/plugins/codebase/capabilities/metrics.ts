#!/usr/bin/env node
/**
 * codebase.metrics capability
 *
 * Computes basic code metrics (lines, functions, classes, imports, exports) for TypeScript/JavaScript files.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join } from "path";
// import { fileURLToPath } from "url"; // unused
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// __filename unused

export const schema = Type.Object({
  files: Type.Array(Type.String(), { description: "List of file paths (relative to cwd)" })
}, { required: ["files"], additionalProperties: false });

interface MetricResult {
  file: string;
  lines: number;
  functions: number;
  classes: number;
  imports: number;
  exports: number;
  error?: string;
}

interface Result {
  results: MetricResult[];
  stats: {
    totalFiles: number;
    totalLines: number;
    totalFunctions: number;
    totalClasses: number;
    totalImports: number;
    totalExports: number;
  };
}

// ParseResult type
interface ParseSuccess {
  source: string;
  ast: any; // AST type could be refined later
}
interface ParseFailure {
  error: string;
}
type ParseResult = ParseSuccess | ParseFailure;

// Generic AST walker
function walk(node: any, visitor: (n: any, parent?: any) => void, parent?: any) {
  if (!node || typeof node !== "object") return;
  visitor(node, parent);
  for (const key in node) {
    if (node[key] && typeof node[key] === "object") {
      if (Array.isArray(node[key])) {
        for (const child of node[key]) walk(child, visitor, node);
      } else {
        walk(node[key], visitor, node);
      }
    }
  }
}

async function parseFile(cwd: string, fileRel: string): Promise<ParseResult> {
  const fileAbs = join(cwd, fileRel);
  try {
    const source = await fs.readFile(fileAbs, "utf8");
    const parser = require('@typescript-eslint/parser');
    const { parse } = parser;
    const ast = parse(source, { sourceType: "module", ecmaVersion: "latest", ts: true, jsx: true });
    return { source, ast };
  } catch (e: any) {
    return { error: e.message };
  }
}

async function analyzeFile(cwd: string, fileRel: string): Promise<MetricResult> {
  const parsed = await parseFile(cwd, fileRel);
  if ('error' in parsed) {
    return { file: fileRel, lines: 0, functions: 0, classes: 0, imports: 0, exports: 0, error: parsed.error };
  }
  const { source, ast } = parsed; // parsed is ParseSuccess here
  const lines = source.split('\n').length;
  let functions = 0, classes = 0, imports = 0, exports = 0;
  walk(ast, (node: any) => {
    switch (node.type) {
      case 'FunctionDeclaration': functions++; break;
      case 'ClassDeclaration': classes++; break;
      case 'ImportDeclaration': imports++; break;
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration': exports++; break;
    }
  });
  return { file: fileRel, lines, functions, classes, imports, exports };
}

function initStats() {
  return { totalLines: 0, totalFunctions: 0, totalClasses: 0, totalImports: 0, totalExports: 0 };
}

function accumulateStats(stats: ReturnType<typeof initStats>, res: MetricResult): void {
  if (!res.error) {
    stats.totalLines += res.lines;
    stats.totalFunctions += res.functions;
    stats.totalClasses += res.classes;
    stats.totalImports += res.imports;
    stats.totalExports += res.exports;
  }
}

function buildStats(results: MetricResult[], stats: ReturnType<typeof initStats>): Result['stats'] {
  return {
    totalFiles: results.length,
    totalLines: stats.totalLines,
    totalFunctions: stats.totalFunctions,
    totalClasses: stats.totalClasses,
    totalImports: stats.totalImports,
    totalExports: stats.totalExports
  };
}

async function computeMetrics(cwd: string, files: string[]): Promise<{ results: MetricResult[]; stats: Result['stats'] }> {
  const results: MetricResult[] = [];
  const stats = initStats();
  for (const fileRel of files) {
    const res = await analyzeFile(cwd, fileRel);
    results.push(res);
    accumulateStats(stats, res);
  }
  return { results, stats: buildStats(results, stats) };
}

function formatResultsAsText(results: MetricResult[], stats: Result['stats']): string {
  const lines: string[] = [];
  lines.push("📊 Code Metrics");
  lines.push("=".repeat(40));
  lines.push(`Total Files: ${stats.totalFiles}`);
  lines.push(`Total Lines: ${stats.totalLines}`);
  lines.push(`Total Functions: ${stats.totalFunctions}`);
  lines.push(`Total Classes: ${stats.totalClasses}`);
  lines.push(`Total Imports: ${stats.totalImports}`);
  lines.push(`Total Exports: ${stats.totalExports}`);
  lines.push("\nPer File:");
  lines.push("-".repeat(40));
  for (const r of results) {
    if (r.error) {
      lines.push(`❌ ${r.file}: ${r.error}`);
    } else {
      lines.push(`${r.file}:`);
      lines.push(`  Lines: ${r.lines}, Functions: ${r.functions}, Classes: ${r.classes}`);
      lines.push(`  Imports: ${r.imports}, Exports: ${r.exports}`);
    }
  }
  return lines.join("\n");
}

/**
 * Computes code metrics (lines, statements, functions, branches) for multiple files.
 * @param params - files array.
 * @param ctx - Context with cwd.
 * @returns Promise with per-file metrics and aggregated statistics.
 */
export async function execute(params: { files: string[] }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const { results, stats } = await computeMetrics(cwd, params.files);

  // Format as CapabilityResult with text content for UI
  const content = [
    {
      type: "text" as const,
      text: formatResultsAsText(results, stats)
    }
  ];

  return {
    content,
    results,
    stats,
    isError: false
  };
}
