#!/usr/bin/env node
/**
 * Tests for codebase.analyze_ast capability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, unlink, rm } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp files (reuse pattern from codebase.test.ts)
async function writeTempFile(content: string, ext = "ts"): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, "temp");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `ast-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

// Import analyze_ast capability
const analyzeAstModule = await import("../capabilities/analyze_ast.ts");

// Type for test context
interface TestContext { cwd: string }

describe("codebase.analyze_ast", () => {
  afterEach(async () => {
    // Cleanup temp folder after each test
    const tempDir = path.join(__dirname, "temp");
    // Note: in parallel tests this could race, but Vitest runs sequentially by default
    // For simplicity we don't delete individual files; we rely on fresh timestamp per file
    // Could add unlink but we know OS will clean eventually.
  });

  it("should handle missing file", async () => {
    const ctx = { cwd: __dirname };
    const result = await analyzeAstModule.execute({ file: "nonexistent.ts" }, ctx as TestContext);

    expect(result.isError).toBe(true);
    expect(result.details?.exists).toBe(false);
  });

  it("should handle parse error (syntax error)", async () => {
    const code = `
import { x } from "y"
function foo() {
  return (
    // missing closing parenthesis
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(true);
    expect(result.details?.error).toBeDefined();

    await unlink(file);
  });

  it("should handle empty file", async () => {
    const code = "";
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.lines).toBe(1); // split('\n') of "" => [""] length 1
    expect(result.details.imports.length).toBe(0);
    expect(result.details.exports.length).toBe(0);
    expect(result.details.symbols.length).toBe(0);
    expect(result.details.language).toBe("ts");

    await unlink(file);
  });

  it("should parse default import", async () => {
    const code = `import defaultImport from "module";`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.imports.length).toBe(1);
    expect(result.details.imports[0].moduleSpecifier).toBe("module");
    expect(result.details.imports[0].importClause).toBe("defaultImport");
    expect(result.details.imports[0].namedImports).toBeUndefined();

    await unlink(file);
  });

  it("should parse namespace import", async () => {
    const code = `import * as ns from "namespace";`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.imports.length).toBe(1);
    expect(result.details.imports[0].moduleSpecifier).toBe("namespace");
    expect(result.details.imports[0].importClause).toBe("* as ns");

    await unlink(file);
  });

  it("should parse named imports", async () => {
    const code = `import { foo, bar as baz } from "lib";`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.imports.length).toBe(1);
    const imp = result.details.imports[0];
    expect(imp.moduleSpecifier).toBe("lib");
    expect(imp.namedImports).toEqual(["foo", "baz"]);

    await unlink(file);
  });

  it("should parse type-only import", async () => {
    const code = `import type { TypeA, TypeB } from "types";`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.imports.length).toBe(1);
    const imp = result.details.imports[0];
    expect(imp.moduleSpecifier).toBe("types");
    expect(imp.namedImports).toEqual(["TypeA", "TypeB"]);
    expect(imp.typeOnly).toBe(true);

    await unlink(file);
  });

  it("should parse mixed imports", async () => {
    const code = "import defaultImp from \"def\";\nimport * as ns from \"ns\";\nimport { named1, named2 as n2 } from \"named\";\nimport type { T1 } from \"types\";";
    const file = await writeTempFile(code), ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);
    expect(result.isError).toBe(false);
    expect(result.details.imports).toHaveLength(4);
    const mods = result.details.imports.map(i => i.moduleSpecifier);
    ["def","ns","named","types"].forEach(m => expect(mods).toContain(m));
    await unlink(file);
  });

  it("should parse named export (function)", async () => {
    const code = `export function exportedFunc() {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.exports.length).toBeGreaterThanOrEqual(1);
    const exp = result.details.exports.find(e => e.name === "exportedFunc");
    expect(exp).toBeDefined();
    expect(exp?.type).toBe("named");
    expect(result.details.symbols.some(s => s.name === "exportedFunc" && s.kind === "function")).toBe(true);

    await unlink(file);
  });

  it("should parse named export (class)", async () => {
    const code = `export class ExportedClass {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.exports.some(e => e.name === "ExportedClass" && e.type === "named")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "ExportedClass" && s.kind === "class")).toBe(true);

    await unlink(file);
  });

  it("should parse named export (type)", async () => {
    const code = `export type MyType = { a: number };`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.exports.some(e => e.name === "MyType" && e.type === "named")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "MyType" && s.kind === "type")).toBe(true);

    await unlink(file);
  });

  it("should parse default export (class)", async () => {
    const code = `export default class DefaultClass {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.exports.some(e => e.type === "default" && e.name === "DefaultClass")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "DefaultClass" && s.kind === "class")).toBe(true);

    await unlink(file);
  });

  it("should parse default export (function)", async () => {
    const code = `export default function defaultFunc() {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.exports.some(e => e.type === "default" && e.name === "defaultFunc")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "defaultFunc" && s.kind === "function")).toBe(true);

    await unlink(file);
  });

  it("should parse re-export with alias", async () => {
    const code = `
import { original } from "./mod";
export { original as renamed };
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    // Export specifier should record both names? Our implementation records exported name, and aliases field if local differs.
    const exp = result.details.exports.find(e => e.name === "renamed");
    expect(exp).toBeDefined();
    expect(exp?.type).toBe("named");
    expect(exp?.aliases).toEqual(["original"]);

    await unlink(file);
  });

  it("should parse export * from", async () => {
    const code = `export * from "./other";`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.exports.some(e => e.type === "all")).toBe(true);

    await unlink(file);
  });

  it("should parse const/let declarations", async () => {
    const code = `
const c = 1;
let l = 2;
var v = 3;
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.symbols.some(s => s.name === "c" && s.kind === "const")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "l" && s.kind === "let")).toBe(true);
    expect(result.details.symbols.some(s => s.name === "v" && s.kind === "variable")).toBe(true);

    await unlink(file);
  });

  it("should parse interface", async () => {
    const code = `interface MyInterface {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.symbols.some(s => s.name === "MyInterface" && s.kind === "interface")).toBe(true);

    await unlink(file);
  });

  it("should parse type alias", async () => {
    const code = `type MyType = string;`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.symbols.some(s => s.name === "MyType" && s.kind === "type")).toBe(true);

    await unlink(file);
  });

  it("should parse enum", async () => {
    const code = `
enum MyEnum {
  A = 0,
  B = 1
}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.symbols.some(s => s.name === "MyEnum" && s.kind === "enum")).toBe(true);

    await unlink(file);
  });

  it("should parse JavaScript file (.js)", async () => {
    const code = `
import { x } from "y";
function foo() {}
export default foo;
    `;
    const file = await writeTempFile(code, "js");
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.language).toBe("js");
    expect(result.details.imports.length).toBeGreaterThan(0);
    expect(result.details.exports.length).toBeGreaterThan(0);
    expect(result.details.symbols.some(s => s.name === "foo" && s.kind === "function")).toBe(true);

    await unlink(file);
  });

  it("should count lines accurately", async () => {
    const code = `line1\nline2\n\nline4\n`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    expect(result.details.lines).toBe(5); // 5 lines including blank

    await unlink(file);
  });

  it("should not duplicate symbols", async () => {
    const code = `
const x = 1;
export { x };
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    const xSymbols = result.details.symbols.filter(s => s.name === "x");
    expect(xSymbols.length).toBe(1);
    // x appears in exports once
    const xExports = result.details.exports.filter(e => e.name === "x");
    expect(xExports.length).toBe(1);

    await unlink(file);
  });

  it("should include column for variable decl (if available)", async () => {
    const code = `  const y = 5;`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);

    expect(result.isError).toBe(false);
    const ySym = result.details.symbols.find(s => s.name === "y");
    expect(ySym).toBeDefined();
    if (ySym?.column !== undefined) {
      expect(ySym.column).toBeGreaterThanOrEqual(0);
    }

    await unlink(file);
  });

  // ----- Additional coverage tests (Cycle 128) -----

  it('should parse interface declaration (verify getSymbolKindFromDeclaration TSInterface case)', async () => {
    const code = `interface I {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);
    expect(result.isError).toBe(false);
    const iface = result.details.symbols.find(s => s.kind === 'interface');
    expect(iface).toBeDefined();
    await unlink(file);
  });

  it('should handle enum declaration as export (symbol kind fallback to variable)', async () => {
    const code = `enum E { A, B }\nexport { E };`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);
    expect(result.isError).toBe(false);
    // Enum not directly recognized by getSymbolKindFromDeclaration, but handled via direct push
    const exp = result.details.exports.find(e => e.name === 'E');
    expect(exp).toBeDefined();
    await unlink(file);
  });

  it('should handle default export of object literal (returns <anonymous>)', async () => {
    const code = `export default {};`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);
    expect(result.isError).toBe(false);
    const def = result.details.exports.find(e => e.type === 'default');
    expect(def).toBeDefined();
    expect(def?.name).toBe('<anonymous>');
    await unlink(file);
  });

  it('should handle default export of arrow function', async () => {
    const code = `export default () => {};`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);
    expect(result.isError).toBe(false);
    const def = result.details.exports.find(e => e.type === 'default');
    expect(def).toBeDefined();
    expect(def?.name).toBe('<default function>');
    await unlink(file);
  });

  it('should recognize .tsx file extension', async () => {
    const code = `const x = 1;`;
    const file = await writeTempFile(code, 'tsx');
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('tsx');
    await unlink(file);
  });

  it('should recognize .jsx file extension', async () => {
    const code = `const x = 1;`;
    const file = await writeTempFile(code, 'jsx');
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeAstModule.execute({ file: path.basename(file) }, ctx as TestContext);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('jsx');
    await unlink(file);
  });

  it('should fallback to process.cwd when ctx.cwd is undefined', async () => {
    const code = `const y = 2;`;
    // Write file in a subdirectory of process.cwd()
    const testDir = path.join(process.cwd(), 'tmp-ast-cwd-test');
    await mkdir(testDir, { recursive: true });
    const file = path.join(testDir, 'cwd-fallback.ts');
    await writeFile(file, code, 'utf-8');
    // ctx without cwd
    const ctx = {} as any;
    const result = await analyzeAstModule.execute({ file: 'tmp-ast-cwd-test/cwd-fallback.ts' }, ctx as TestContext);
    expect(result.isError).toBe(false);
    // Cleanup
    await unlink(file);
    await rm(testDir, { recursive: true, force: true });
  });
});
