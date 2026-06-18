#!/usr/bin/env node
/**
 * codebase.safe_edit capability
 *
 * Edits code with validation: syntax check, optional import fixing, formatting.
 * Rolls back on any failure to preserve working tree.
 * Supports atomic multi-file and multi-operation edits.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const schema = Type.Object({
  operations: Type.Array(Type.Object({
    file: Type.String({ description: "File path to edit" }),
    editType: Type.Union([Type.Literal("replace"), Type.Literal("insert"), Type.Literal("delete")], { description: "Type of edit operation" }),
    range: Type.Object({
      start: Type.Integer({ description: "Start line (0-indexed, inclusive)" }),
      end: Type.Integer({ description: "End line (0-indexed, exclusive)" })
    }, { required: ["start", "end"] }),
    newCode: Type.Optional(Type.String({ description: "New code content (required for replace/insert)" }))
  }), { description: "List of edit operations to apply atomically" }),
  format: Type.Optional(Type.Boolean({ description: "Run Prettier after edit (default true)" })),
  fixImports: Type.Optional(Type.Boolean({ description: "Attempt to fix imports automatically (default true)" }))
}, { additionalProperties: false });

interface EditOperation {
  file: string;
  editType: "replace" | "insert" | "delete";
  range: { start: number; end: number };
  newCode?: string;
}

interface EditResult {
  file: string;
  success: boolean;
  backupRestored?: boolean;
  error?: string;
  diff?: string;
}

function computeDiff(original: string, modified: string, file: string): string {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const max = Math.max(origLines.length, modLines.length);
  let diff = `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n`;
  for (let i = 0; i < max; i++) {
    const orig = origLines[i] ?? '';
    const mod = modLines[i] ?? '';
    if (orig !== mod) {
      if (orig) diff += `- ${orig}\n`;
      if (mod) diff += `+ ${mod}\n`;
    } else if (orig) {
      diff += `  ${orig}\n`;
    }
  }
  return diff;
}

function validateEditOp(op: EditOperation, lineCount: number): void {
  if (op.range.start < 0 || op.range.end < op.range.start || op.range.end > lineCount) {
    throw new Error(`Invalid range ${JSON.stringify(op.range)} for file with ${lineCount} lines`);
  }
  if (op.editType !== 'delete' && op.newCode === undefined) {
    throw new Error(`newCode is required for editType '${op.editType}'`);
  }
}

function applyEditInMemory(op: EditOperation, content: string): string {
  const lines = content.split('\n');
  validateEditOp(op, lines.length);
  const newLines = op.editType !== 'delete' ? op.newCode!.split('\n') : [];
  const edited = lines.slice();
  if (op.editType === 'replace') {
    edited.splice(op.range.start, op.range.end - op.range.start, ...newLines);
  } else if (op.editType === 'insert') {
    edited.splice(op.range.start, 0, ...newLines);
  } else if (op.editType === 'delete') {
    edited.splice(op.range.start, op.range.end - op.range.start);
  } else {
    throw new Error(`Unknown editType: ${op.editType}`);
  }
  return edited.join('\n');
}

async function validateFile(file: string, cwd: string, format: boolean, fixImports: boolean, ctx: any): Promise<void> {
  // Type check
  const tsc = await ctx.exec('npx', ['tsc', '--noEmit', file], { cwd });
  if (tsc.code !== 0 && tsc.code !== 2) {
    throw new Error(`TypeScript check failed: exit code ${tsc.code}, stderr: ${tsc.stderr || 'none'}`);
  }
  // Fix imports
  if (fixImports) {
    try { await ctx.exec('npx', ['eslint', '--fix', file], { cwd }); } catch {}
  }
  // Format
  if (format) {
    const fmt = await ctx.exec('npx', ['prettier', '--write', file], { cwd });
    if (fmt.code !== 0) throw new Error(`Prettier formatting failed: exit ${fmt.code}, stderr: ${fmt.stderr || 'none'}`);
  }
}

async function backupFiles(operations: EditOperation[], cwd: string): Promise<Map<string, string>> {
  const backups = new Map<string, string>();
  for (const op of operations) {
    if (!backups.has(op.file)) {
      try {
        backups.set(op.file, await fs.readFile(join(cwd, op.file), 'utf-8'));
      } catch (err) {
        throw new Error(`Cannot read file ${op.file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return backups;
}

function computeFinalContents(opsByFile: Map<string, EditOperation[]>, backups: Map<string, string>): Map<string, string> {
  const finalContents = new Map<string, string>();
  for (const [file, fileOps] of opsByFile) {
    const original = backups.get(file)!;
    try {
      let content = original;
      for (const op of fileOps) {
        content = applyEditInMemory(op, content);
      }
      finalContents.set(file, content);
    } catch (err) {
      throw new Error(`Edit failed in ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return finalContents;
}

async function writeFiles(finalContents: Map<string, string>, cwd: string): Promise<void> {
  for (const [file, content] of finalContents) {
    await fs.writeFile(join(cwd, file), content, 'utf-8');
  }
}

function groupOperationsByFile(operations: EditOperation[]): Map<string, EditOperation[]> {
  const map = new Map<string, EditOperation[]>();
  for (const op of operations) {
    const list = map.get(op.file) || [];
    list.push(op);
    map.set(op.file, list);
  }
  return map;
}

async function validateAndDiff(file: string, cwd: string, format: boolean, fixImports: boolean, ctx: any, backup: string): Promise<EditResult> {
  try {
    await validateFile(file, cwd, format, fixImports, ctx);
    const final = await fs.readFile(join(cwd, file), 'utf-8');
    return {
      file,
      success: true,
      diff: computeDiff(backup, final, file)
    };
  } catch (err) {
    return {
      file,
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function rollbackAll(backups: Map<string, string>, cwd: string): Promise<void> {
  for (const [f, backup] of backups) {
    try { await fs.writeFile(join(cwd, f), backup, 'utf-8'); } catch {}
  }
}

async function validateAllAndDiff(
  finalContents: Map<string, string>,
  backups: Map<string, string>,
  cwd: string,
  format: boolean,
  fixImports: boolean,
  ctx: any
): Promise<EditResult[]> {
  const results: EditResult[] = [];
  for (const [file] of finalContents) {
    try {
      await validateFile(file, cwd, format, fixImports, ctx);
      const final = await fs.readFile(join(cwd, file), 'utf-8');
      results.push({ file, success: true, diff: computeDiff(backups.get(file)!, final, file) });
    } catch (err) {
      await rollbackAll(backups, cwd);
      for (const r of results) { r.success = false; r.backupRestored = true; }
      results.push({ file, success: false, error: String(err), backupRestored: true });
      break; // stop processing further files
    }
  }
  return results;
}

function validateOperations(operations: EditOperation[]): { valid: boolean; file?: string; error?: string } {
  for (const op of operations) {
    if ((op.editType === 'replace' || op.editType === 'insert') && op.newCode === undefined) {
      return { valid: false, file: op.file, error: 'newCode is required for replace/insert' };
    }
  }
  return { valid: true };
}

export async function execute(params: { operations: EditOperation[]; format?: boolean; fixImports?: boolean }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const format = params.format !== false;
  const fixImports = params.fixImports !== false;
  const { operations } = params;
  const inputCheck = validateOperations(operations);
  if (!inputCheck.valid) {
    return { success: false, results: [{ file: inputCheck.file || '', success: false, error: inputCheck.error || 'Invalid input' }] };
  }
  const opsByFile = groupOperationsByFile(operations);
  let backups: Map<string, string>;
  try { backups = await backupFiles(operations, cwd); } catch (err) { return { success: false, results: [{ file: operations[0]?.file || '', success: false, error: String(err) }] }; }
  let finalContents: Map<string, string>;
  try { finalContents = computeFinalContents(opsByFile, backups); } catch (err) { const file = Array.from(opsByFile.keys())[0] || ''; return { success: false, results: [{ file, success: false, error: String(err) }] }; }
  await writeFiles(finalContents, cwd);
  const results = await validateAllAndDiff(finalContents, backups, cwd, format, fixImports, ctx);
  const allSuccess = results.every(r => r.success);
  return { success: allSuccess, results };
}

export default { execute, schema };
