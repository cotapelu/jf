#!/usr/bin/env node
/**
 * Tests for codebase.ast_query capability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, unlink } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp files
async function writeTempFile(content: string, ext = "ts"): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, "temp");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `query-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

// Import ast_query capability
const astQueryModule = await import("../capabilities/ast_query.ts");

// Types
interface AstQueryDetails {
  file: string;
  exists: boolean;
  language: string;
  lines: number;
  nodes: Array<{ kind: string; name?: string; line: number; column?: number; parent?: string }>;
  total: number;
  error?: string;
}

describe("codebase.ast_query", () => {
  afterEach(async () => {
    // Cleanup not strictly needed; temp files overwritten with timestamp
  });

  it("should handle missing file", async () => {
    const ctx = { cwd: __dirname };
    const result = await astQueryModule.execute({ file: "nonexistent.ts", query: { kind: "function" } }, ctx as { cwd: string });

    expect(result.isError).toBe(true);
    expect(result.details?.exists).toBe(false);
  });

  it("should handle parse error", async () => {
    const code = `import { x } from "y"
function foo() {
  return (`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function" } }, ctx as { cwd: string });

    expect(result.isError).toBe(true);
    expect(result.details?.error).toBeDefined();

    await unlink(file);
  });

  it("should find functions by exact name", async () => {
    const code = `
function target() {}
function other() {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", name: "target" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBe(1);
    expect(result.details.matches[0].name).toBe("target");

    await unlink(file);
  });

  it("should find functions by regex pattern", async () => {
    const code = `
function fooBar() {}
function bazQux() {}
function fooBaz() {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", name: "foo.*" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain("fooBar");
    expect(names).toContain("fooBaz");
    expect(names).not.toContain("bazQux");

    await unlink(file);
  });

  it("should find classes", async () => {
    const code = `
class MyClass {}
interface MyInterface {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "class" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    const classMatches = result.details.matches.filter(m => m.kind === "class");
    expect(classMatches.length).toBe(1);
    expect(classMatches[0].name).toBe("MyClass");

    await unlink(file);
  });

  it("should find call expressions", async () => {
    const code = `
foo();
bar();
baz();
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "call", name: "foo" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBe(1);
    expect(result.details.matches[0].name).toBe("foo");

    await unlink(file);
  });

  it("should find symbols (variables, types, etc)", async () => {
    const code = `
const x = 1;
let y = 2;
type MyType = string;
interface MyInterface {}
enum MyEnum { A, B }
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "symbol" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain("x");
    expect(names).toContain("y");
    expect(names).toContain("MyType");
    expect(names).toContain("MyInterface");
    expect(names).toContain("MyEnum");

    await unlink(file);
  });

  it("should find imports", async () => {
    const code = `
import { foo } from "module1";
import * as ns from "module2";
import defaultImp from "module3";
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "import" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBe(3);
    const moduleNames = result.details.matches.map(m => m.name);
    expect(moduleNames).toContain("module1");
    expect(moduleNames).toContain("module2");
    expect(moduleNames).toContain("module3");

    await unlink(file);
  });

  it("should find exports", async () => {
    const code = `
export const x = 1;
export function foo() {}
export default class Bar {}
export type MyType = string;
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "export" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBeGreaterThanOrEqual(3);
    const names = result.details.matches.map(m => m.name).filter(n => n);
    expect(names).toContain("x");
    expect(names).toContain("foo");
    expect(names).toContain("Bar");
    expect(names).toContain("MyType");

    await unlink(file);
  });

  it("should respect limit", async () => {
    const code = Array.from({ length: 10 }, (_, i) => `function fn${i}() {}`).join('\n');
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", limit: 5 } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBe(5);

    await unlink(file);
  });

  it("should filter by parent (functions inside class)", async () => {
    const code = `
class MyClass {
  method() {}
}
function standalone() {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", parent: "MyClass" } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBe(1);
    expect(result.details.matches[0].name).toBe("method");
    expect(result.details.matches[0].parent).toBe("MyClass");

    await unlink(file);
  });

  it('should find arrow functions (kind=function)', async () => {
    const code = `const f = () => {}; const g = function() {};`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: 'function' } }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain('<arrow>');
    expect(names).toContain('<anonymous>');
    await unlink(file);
  });

  it('should handle export * from (ExportAllDeclaration)', async () => {
    const code = `export * from './other';`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: 'export' } }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain('*');
    await unlink(file);
  });

  it('should handle invalid regex pattern (fallback to no matches)', async () => {
    const code = `function target() {} function other() {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: 'function', name: 'targ[' } }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.matches).toHaveLength(0);
    await unlink(file);
  });

  // Additional branch coverage tests for ast_query
  it('should find symbols for functions and classes', async () => {
    const code = `
function foo() {}
class Bar {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: 'symbol' } }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain('foo');
    expect(names).toContain('Bar');
    await unlink(file);
  });

  it('should find call expressions with member expression (obj.method())', async () => {
    const code = `
const obj = { method() {} };
obj.method();
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: 'call', name: 'method' } }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBe(1);
    expect(result.details.matches[0].name).toBe('method');
    await unlink(file);
  });

  it('should find export named declaration without specifiers', async () => {
    const code = `export {};`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: 'export' } }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.matches.length).toBe(1);
    expect(result.details.matches[0].name).toBe('<export>');
    await unlink(file);
  });



});
