#!/usr/bin/env node
/**
 * Tests for codebase plugin capabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, readFile, unlink, readdir, rm, mkdtemp } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp files
async function writeTempFile(content: string, ext = "ts"): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, "temp");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `test-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

// Mock context with exec
function createMockCtx(cwd: string) {
  const execCommands: Array<{ cmd: string; args: string[]; opts?: any }> = [];
  return {
    cwd,
    exec: async (cmd: string, args: string[], opts?: any) => {
      execCommands.push({ cmd, args, opts });
      // Simulate success for prettier/eslint/tsc
      if (cmd === "npx" && args[0] === "tsc") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (cmd === "npx" && (args[0] === "eslint" || args[0] === "prettier")) {
        return { code: 0, stdout: "", stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    }
  };
}

// Import capabilities
const analyzeModule = await import("../capabilities/analyze.ts");
const safeEditModule = await import("../capabilities/safe_edit.ts");

// Types for analyze and safe_edit results
interface AnalyzeDetails {
  file?: string;
  exists: boolean;
  imports: Array<{ moduleSpecifier: string; importClause?: string; namedImports?: string[]; typeOnly?: boolean }>;
  exports: Array<{ type: string; name?: string; aliases?: string[] }>;
  symbols: Array<{ name: string; kind: string; line: number; column?: number }>;
  language?: string;
  lines?: number;
  error?: string;
}

interface SafeEditDetails {
  success: boolean;
  file: string;
  message: string;
  backupPath?: string;
  diff?: string;
}

describe("codebase.analyze", () => {
  // Helper to run analyze capability with automatic cleanup
  async function runAnalyze(code: string): Promise<any> {
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    try {
      return await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    } finally {
      await unlink(file);
    }
  }


  it("should parse simple imports and exports", async () => {
    const code = "import { foo, bar as baz } from \"lib\";\nimport * as ns from \"ns\";\nimport defaultImport from \"def\";\nexport { foo, bar };\nexport default class MyClass {}\nexport type MyType = string;\nconst x = 1;\nlet y = 2;\nfunction myFunc() {}";
    const result = await runAnalyze(code);
    expect(result.isError).toBe(false);
    expect(result.details.imports.length).toBeGreaterThanOrEqual(3);
    expect(result.details.exports.length).toBeGreaterThanOrEqual(3);
    expect(result.details.symbols.some(s => s.name === "MyClass" && s.kind === "class")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "MyType" && s.kind === "type")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "myFunc" && s.kind === "function")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "x" && s.kind === "variable")).toBe(true);
  });

  it("should report missing file as error", async () => {
    const ctx = { cwd: __dirname };
    const result = await analyzeModule.execute({ file: "nonexistent.ts" }, ctx as { cwd: string });
    expect(result.isError).toBe(true);
    expect(result.details.exists).toBe(false);
  });

  it("should count lines correctly", async () => {
    const code = "line1\nline2\nline3";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.details.lines).toBe(3);
    await unlink(file);
  });

  it("should detect language from extension", async () => {
    const code = "export {};";
    const file = await writeTempFile(code, "tsx");
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.details.language).toBe("tsx");
    await unlink(file);
  });

  it('should return unknown language for unsupported extension', async () => {
    const code = "export {};";
    const file = await writeTempFile(code, "xyz");
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.details.language).toBe("unknown");
    await unlink(file);
  });

  it('should handle read error gracefully', async () => {
    const dir = path.join(__dirname, 'temp_no_read');
    await mkdir(dir, { recursive: true });
    const ctx = { cwd: dir };
    const result = await analyzeModule.execute({ file: '.' }, ctx as { cwd: string });
    expect(result.isError).toBe(true);
    expect(result.details.error).toBeDefined();
    await rm(dir, { recursive: true, force: true });
  });

  it('should handle empty file', async () => {
    const file = await writeTempFile('');
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.lines).toBe(1);
    await unlink(file);
  });

  // Additional branch coverage tests for analyze.ts

  it('should parse re-export star', async () => {
    const code = "export * from 'lib';";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.imports.length).toBe(0);
    expect(result.details.exports.length).toBe(1);
    expect(result.details.exports[0].type).toBe('named');
    expect(result.details.exports[0].name).toBe('*');
    await unlink(file);
  });

  it('should parse named export with alias', async () => {
    const code = "export { foo as bar };";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.exports.length).toBe(1);
    expect(result.details.exports[0].type).toBe('named');
    expect(result.details.exports[0].name).toBe('foo');
    expect(result.details.exports[0].aliases).toEqual(['bar']);
    await unlink(file);
  });

  it('should parse export default function', async () => {
    const code = "export default function foo() {}";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.exports.length).toBe(1);
    expect(result.details.exports[0].type).toBe('default');
    expect(result.details.exports[0].name).toBe('foo');
    expect(result.details.symbols.some(s => s.kind === 'function' && s.name === 'foo')).toBe(true);
    await unlink(file);
  });

  it('should parse export default const', async () => {
    const code = "export default const x = 1;";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.exports.length).toBe(1);
    expect(result.details.exports[0].type).toBe('default');
    expect(result.details.exports[0].name).toBe('x');
    expect(result.details.symbols.some(s => s.kind === 'variable' && s.name === 'x')).toBe(true);
    await unlink(file);
  });

  it('should parse export default interface', async () => {
    const code = "export default interface MyInterface {}";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.exports.length).toBe(1);
    expect(result.details.exports[0].type).toBe('default');
    expect(result.details.exports[0].name).toBe('MyInterface');
    expect(result.details.symbols.some(s => s.kind === 'interface' && s.name === 'MyInterface')).toBe(true);
    await unlink(file);
  });

  it('should parse export default type', async () => {
    const code = "export default type MyType = string;";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.exports.length).toBe(1);
    expect(result.details.exports[0].type).toBe('default');
    expect(result.details.exports[0].name).toBe('MyType');
    expect(result.details.symbols.some(s => s.kind === 'type' && s.name === 'MyType')).toBe(true);
    await unlink(file);
  });

  it('should parse enum symbol', async () => {
    const code = "enum Colors { Red, Green, Blue }";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.symbols.some(s => s.kind === 'enum' && s.name === 'Colors')).toBe(true);
    await unlink(file);
  });

  it('should parse interface symbol', async () => {
    const code = "interface MyInterface { x: number; }";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.symbols.some(s => s.kind === 'interface' && s.name === 'MyInterface')).toBe(true);
    await unlink(file);
  });

  it('should parse export interface', async () => {
    const code = "export interface ExportedInterface { method(): void; }";
    const result = await runAnalyze(code);
    expect(result.isError).toBe(false);
    expect(result.details.exports.length).toBe(1);
    expect(result.details.exports[0].type).toBe('named');
    expect(result.details.exports[0].name).toBe('ExportedInterface');
    expect(result.details.symbols.some(s => s.kind === 'interface' && s.name === 'ExportedInterface')).toBe(true);
  });
});

describe("codebase.safe_edit", () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "codebase-safe-"));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("should replace lines successfully", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "line1\nline2\nline3", "utf-8");
    const ctx = createMockCtx(tempDir);
    const params = { operations: [{ file: "sample.ts", editType: "replace" as const, range: { start: 1, end: 2 }, newCode: "modified" }] };
    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(true);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].diff).toContain("+ modified");
    expect(result.results[0].diff).toContain("- line2");
    expect(await readFile(file, "utf-8")).toBe("line1\nmodified\nline3");
  });

  it("should insert lines successfully", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "line1\nline3", "utf-8");
    const ctx = createMockCtx(tempDir);

    const params = {
      operations: [{
        file: "sample.ts",
        editType: "insert" as const,
        range: { start: 1, end: 1 }, // insert at line 2 (between line1 and line3)
        newCode: "inserted"
      }]
    };

    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(true);
    const content = await readFile(file, "utf-8");
    expect(content).toBe("line1\ninserted\nline3");
  });

  it("should delete lines successfully", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "line1\nline2\nline3", "utf-8");
    const ctx = createMockCtx(tempDir);

    const params = {
      operations: [{
        file: "sample.ts",
        editType: "delete" as const,
        range: { start: 1, end: 2 },
        newCode: ""
      }]
    };

    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(true);
    const content = await readFile(file, "utf-8");
    expect(content).toBe("line1\nline3");
  });

  it("should rollback on syntax error", async () => {
    const file = path.join(tempDir, "sample.ts");
    const original = "export const x = 1;";
    await writeFile(file, original, "utf-8");
    const ctx = createMockCtx(tempDir);
    ctx.exec = async (cmd: string, args: string[]) => cmd === "npx" && args[0] === "tsc" ? { code: 1, stdout: "", stderr: "error TS" } : { code: 0, stdout: "", stderr: "" };
    const params = { operations: [{ file: "sample.ts", editType: "replace", range: { start: 0, end: 1 }, newCode: "const x: number = 'str';" }], format: false, fixImports: false };
    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(false);
    expect(result.results[0].backupRestored).toBe(true);
    expect(await readFile(file, "utf-8")).toBe(original);
  });

  it("should rollback on prettier failure", async () => {
    const file = path.join(tempDir, "sample.ts");
    const original = "export const x = 1;";
    await writeFile(file, original, "utf-8");
    const ctx = createMockCtx(tempDir);
    ctx.exec = async (cmd: string, args: string[]) => cmd === "npx" && args[0] === "prettier" ? { code: 1, stdout: "", stderr: "prettier fail" } : { code: 0, stdout: "", stderr: "" };
    const params = { operations: [{ file: "sample.ts", editType: "replace", range: { start: 0, end: 1 }, newCode: "export const x = 2;" }], format: true, fixImports: false };
    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(false);
    expect(result.results[0].backupRestored).toBe(true);
    expect(await readFile(file, "utf-8")).toBe(original);
  });

  it("should handle invalid range", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "line1\nline2", "utf-8");
    const ctx = createMockCtx(tempDir);

    const params = {
      operations: [{
        file: "sample.ts",
        editType: "replace",
        range: { start: 0, end: 10 }, // out of bounds
        newCode: "new"
      }]
    };

    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain("Invalid range");
  });

  it("should require newCode for replace/insert", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "content", "utf-8");
    const ctx = createMockCtx(tempDir);

    const params = {
      operations: [{
        file: "sample.ts",
        editType: "replace" as const,
        range: { start: 0, end: 1 },
        // @ts-ignore - intentionally missing newCode for error test
        newCode: undefined
      }]
    };

    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain("newCode is required");
  });

  it("should apply multiple operations on same file atomically", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "a\nb\nc\nd", "utf-8");
    const ctx = createMockCtx(tempDir);

    const params = {
      operations: [
        { file: "sample.ts", editType: "replace" as const, range: { start: 0, end: 1 }, newCode: "A" },
        { file: "sample.ts", editType: "replace" as const, range: { start: 1, end: 2 }, newCode: "B" }
      ]
    };

    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(true);
    const content = await readFile(file, "utf-8");
    expect(content).toBe("A\nB\nc\nd");
  });

  it("should apply multiple operations on different files atomically", async () => {
    const file1 = path.join(tempDir, "a.ts"), file2 = path.join(tempDir, "b.ts");
    await Promise.all([writeFile(file1, "orig1", "utf-8"), writeFile(file2, "orig2", "utf-8")]);
    const ctx = createMockCtx(tempDir);
    const params = { operations: [{ file: "a.ts", editType: "replace" as const, range: { start: 0, end: 1 }, newCode: "changed1" }, { file: "b.ts", editType: "replace" as const, range: { start: 0, end: 1 }, newCode: "changed2" }], format: false, fixImports: false };
    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(true);
    expect(await readFile(file1, "utf-8")).toBe("changed1");
    expect(await readFile(file2, "utf-8")).toBe("changed2");
  });

  it("should rollback all files if one fails (atomic across files)", async () => {
    const file1 = path.join(tempDir, "a.ts"), file2 = path.join(tempDir, "b.ts");
    await Promise.all([writeFile(file1, "original1", "utf-8"), writeFile(file2, "original2", "utf-8")]);
    const ctx = createMockCtx(tempDir);
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === "npx" && args[0] === "tsc") {
        const fileArg = args[2];
        if (fileArg?.includes("b.ts")) return { code: 1, stdout: "", stderr: "error" };
      }
      return { code: 0, stdout: "", stderr: "" };
    };
    const params = { operations: [{ file: "a.ts", editType: "replace" as const, range: { start: 0, end: 1 }, newCode: "changed1" }, { file: "b.ts", editType: "replace" as const, range: { start: 0, end: 1 }, newCode: "changed2" }], format: false, fixImports: false };
    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(false);
    expect(await readFile(file1, "utf-8")).toBe("original1");
    expect(await readFile(file2, "utf-8")).toBe("original2");
    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => !r.success && r.backupRestored)).toBe(true);
  });

  it("should skip format when format=false", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "code", "utf-8");
    const ctx = createMockCtx(tempDir);
    let prettierCalled = false;
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === "npx" && args[0] === "prettier") prettierCalled = true;
      return { code: 0, stdout: "", stderr: "" };
    };

    const params = {
      operations: [{ file: "sample.ts", editType: "replace" as const, range: { start: 0, end: 1 }, newCode: "new" }],
      format: false
    };
    await safeEditModule.execute(params, ctx as { cwd: string });
    expect(prettierCalled).toBe(false);
  });

  it("should skip eslint when fixImports=false", async () => {
    const file = path.join(tempDir, "sample.ts");
    await writeFile(file, "code", "utf-8");
    const ctx = createMockCtx(tempDir);
    let eslintCalled = false;
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === "npx" && args[0] === "eslint") eslintCalled = true;
      return { code: 0, stdout: "", stderr: "" };
    };

    const params = {
      operations: [{ file: "sample.ts", editType: "replace" as const, range: { start: 0, end: 1 }, newCode: "new" }],
      fixImports: false
    };
    await safeEditModule.execute(params, ctx as { cwd: string });
    expect(eslintCalled).toBe(false);
  });
});
