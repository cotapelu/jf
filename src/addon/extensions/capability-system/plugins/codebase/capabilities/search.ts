#!/usr/bin/env node
/**
 * codebase.search capability
 *
 * Searches code files for a query string (case-sensitive or insensitive).
 * Returns matching lines with file path, line number, column, and snippet.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, extname, relative } from "path";
// removed unused url import and __filename

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

export const schema = Type.Object({
  query: Type.String({ description: "Search query (plain text)" }),
  filePattern: Type.Optional(Type.String({ description: "Optional file extension filter (e.g., '.ts') or partial path" })),
  maxResults: Type.Optional(Type.Integer({ description: "Maximum results to return (default 50)" })),
  caseSensitive: Type.Optional(Type.Boolean({ description: "Case-sensitive search (default false)" }))
}, { additionalProperties: false });

interface SearchMatch {
  file: string;
  line: number;
  column: number;
  text: string;
}

async function walkDir(dir: string, callback: (filePath: string) => Promise<void> | void, opts: { ignoreDirs?: string[] } = {}): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'coverage' || entry.name === '.next') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(full, callback, opts);
    } else if (entry.isFile()) {
      await callback(full);
    }
  }
}

function shouldProcess(ext: string, filePath: string, filePattern?: string): boolean {
  if (!CODE_EXTENSIONS.includes(ext)) return false;
  if (!filePattern) return true;
  if (filePattern.includes(ext)) return true;
  if (filePath.toLowerCase().includes(filePattern.toLowerCase())) return true;
  if (filePattern.startsWith('.') && ext === filePattern.toLowerCase()) return true;
  return false;
}

async function scanAndCollect(filePath: string, cwd: string, query: string, caseSensitive: boolean, matches: SearchMatch[], maxResults: number): Promise<boolean> {
  if (matches.length >= maxResults) return true;
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split('\n');
  const q = caseSensitive ? query : query.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (matches.length >= maxResults) return true;
    const line = lines[i];
    const searchIn = caseSensitive ? line : line.toLowerCase();
    const idx = searchIn.indexOf(q);
    if (idx !== -1) {
      const relPath = relative(cwd, filePath);
      matches.push({
        file: relPath,
        line: i + 1,
        column: idx + 1,
        text: line.trim().substring(0, 120)
      });
    }
  }
  return matches.length >= maxResults;
}

interface ScanContext {
  cwd: string;
  query: string;
  maxResults: number;
  caseSensitive: boolean;
  filePattern: string | undefined;
  matches: SearchMatch[];
}

async function handleFile(filePath: string, ctx: ScanContext): Promise<void> {
  if (ctx.matches.length >= ctx.maxResults) return;
  const ext = extname(filePath).toLowerCase();
  if (!shouldProcess(ext, filePath, ctx.filePattern)) return;
  await scanAndCollect(filePath, ctx.cwd, ctx.query, ctx.caseSensitive, ctx.matches, ctx.maxResults);
}

function formatSearchOutput(matches: SearchMatch[], query: string): string {
  return matches.length === 0
    ? `No matches for "${query}"`
    : matches.map(m => `${m.file}:${m.line}:${m.column}: ${m.text}`).join('\n');
}

export async function execute(params: { query: string; filePattern?: string; maxResults?: number; caseSensitive?: boolean }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const query = params.query;
  if (!query) {
    return { content: [{ type: "text", text: "Query is required" }], isError: true };
  }
  const maxResults = params.maxResults ?? 50;
  const caseSensitive = params.caseSensitive ?? false;
  const filePattern = params.filePattern?.toLowerCase();

  const matches: SearchMatch[] = [];

  const context: ScanContext = { cwd, query, maxResults, caseSensitive, filePattern, matches };
  try {
    await walkDir(cwd, (fp) => handleFile(fp, context));
  } catch {
    // ignore
  }

  const output = formatSearchOutput(matches, query);
  return {
    content: [{ type: "text" as const, text: output }],
    details: { matches, total: matches.length, query },
    isError: false
  };
}

export default { execute, schema };
