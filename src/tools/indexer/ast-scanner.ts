import { readFile, readdir } from 'fs/promises';
import { join, relative, extname } from 'path';
import * as ts from 'typescript';

export interface SymbolMatch {
  file: string;
  name: string;
  kind: string;
  line: number;
  column: number;
}

/** Get kind string for a TS node */
function getSymbolKind(node: ts.Node): string | null {
  const kind = node.kind;
  if (kind === ts.SyntaxKind.FunctionDeclaration) return 'function';
  if (kind === ts.SyntaxKind.ClassDeclaration) return 'class';
  if (kind === ts.SyntaxKind.InterfaceDeclaration) return 'interface';
  if (kind === ts.SyntaxKind.MethodDeclaration) return 'method';
  if (kind === ts.SyntaxKind.Constructor) return 'constructor';
  if (kind === ts.SyntaxKind.TypeAliasDeclaration) return 'type';
  if (kind === ts.SyntaxKind.VariableDeclaration) return 'variable';
  return null;
}

/** Get symbol name from node */
function getSymbolName(node: ts.Node): string | null {
  if (ts.isVariableDeclaration(node)) {
    return (node.name as ts.Identifier).text;
  }
  const named = node as any;
  if (named.name) {
    return named.name.getText?.() ?? named.name?.text ?? null;
  }
  return null;
}

/** Walk AST recursively and collect matches */
function walk(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  cwd: string,
  results: SymbolMatch[],
  options: { query?: string; kind?: string; limit: number }
) {
  if (results.length >= options.limit) return;

  const kind = getSymbolKind(node);
  if (kind && (options.kind === 'all' || kind === options.kind)) {
    const name = getSymbolName(node);
    if (name) {
      const lowerQuery = options.query?.toLowerCase();
      if (!lowerQuery || name.toLowerCase().includes(lowerQuery)) {
        const pos = node.getFullStart();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        results.push({
          file: relative(cwd, sourceFile.fileName),
          name,
          kind,
          line: line + 1,
          column: character + 1,
        });
      }
    }
  }
  ts.forEachChild(node, child => walk(child, sourceFile, cwd, results, options));
}

/** Recursively collect .ts files */
async function collectTsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walkDir(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walkDir(full);
      } else if (entry.isFile() && extname(full) === '.ts') {
        files.push(full);
      }
    }
  }
  await walkDir(dir);
  return files;
}

/** Main scan function */
export async function scanCodebase(
  cwd: string,
  options: {
    query?: string;
    kind?: string;
    filePattern?: string;
    limit?: number;
  } = {}
): Promise<{ matches: SymbolMatch[] }> {
  const { kind = 'all', limit = 50 } = options;
  const files = await collectTsFiles(cwd);
  const matches: SymbolMatch[] = [];

  for (const file of files) {
    if (matches.length >= limit) break;
    try {
      const sourceText = await readFile(file, 'utf-8');
      const sourceFile = ts.createSourceFile(relative(cwd, file), sourceText, ts.ScriptTarget.Latest, true);
      walk(sourceFile, sourceFile, cwd, matches, { ...options, kind, limit });
    } catch {
      // ignore files that can't be read or parsed
    }
  }

  return { matches: matches.slice(0, limit) };
}
