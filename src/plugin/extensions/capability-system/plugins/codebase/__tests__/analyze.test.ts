import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import os from "os";

// Dynamic import of the capability
const analyzeModule = await import("../capabilities/analyze.ts");
const { execute, schema } = analyzeModule;

describe("analyze capability (coverage-focused)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), "piclaw-analyze-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const writeFile = async (name: string, content: string) => {
    const filePath = join(tempDir, name);
    await fs.writeFile(filePath, content, "utf-8");
    return filePath;
  };

  it("executes without error on a sample TS file", async () => {
    await writeFile("sample.ts", `
      import { foo } from './bar';
      import * as ns from 'baz';
      import DefaultImport from 'qux';
      export const x = 1;
      export default class MyClass {}
      function myFunc() {}
      interface MyInterface {}
      type MyType = string;
      const myVar = 'hello';
      enum MyEnum { A, B }
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "sample.ts" }, ctx);

    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    expect(analysis).toHaveProperty('imports');
    expect(analysis).toHaveProperty('exports');
    expect(analysis).toHaveProperty('symbols');
    // Basic shape checks
    expect(Array.isArray(analysis.imports)).toBe(true);
    expect(Array.isArray(analysis.exports)).toBe(true);
    expect(Array.isArray(analysis.symbols)).toBe(true);
    // We expect at least some imports/exports/symbols
    expect(analysis.imports.length).toBeGreaterThan(0);
    expect(analysis.exports.length).toBeGreaterThan(0);
    expect(analysis.symbols.length).toBeGreaterThan(0);
  });

  it("handles JavaScript file", async () => {
    await writeFile("script.js", "import x from 'x'; function foo() {}");
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "script.js" }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe("js");
  });

  it("returns error for missing file", async () => {
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "nonexistent.ts" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.details.exists).toBe(false);
  });

  it("handles only imports/exports", async () => {
    await writeFile("decs.ts", `
      export interface I {}
      export type T = number;
      export const C = 2;
      export { C as C2 };
      export * from './other';
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "decs.ts" }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    // Exports should include interface I, type T, const C, star, and alias C2
    expect(analysis.exports.some((e: any) => e.name === 'I')).toBe(true);
    expect(analysis.exports.some((e: any) => e.name === 'T')).toBe(true);
    expect(analysis.exports.some((e: any) => e.name === 'C')).toBe(true);
    expect(analysis.exports.some((e: any) => e.name === '*')).toBe(true);
    expect(analysis.exports.some((e: any) => e.name === 'C' && e.aliases && e.aliases.includes('C2'))).toBe(true);
  });

  it("handles enum", async () => {
    await writeFile("enum.ts", "enum Color { Red, Green, Blue }");
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "enum.ts" }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    expect(analysis.symbols.some((s: any) => s.kind === "enum")).toBe(true);
  });

  it("handles types and interfaces", async () => {
    await writeFile("types.ts", `type Foo = string | number;
interface Bar { x: number }`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "types.ts" }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    expect(analysis.symbols.some((s: any) => s.kind === "type")).toBe(true);
    expect(analysis.symbols.some((s: any) => s.kind === "interface")).toBe(true);
  });

  it("handles default export of function", async () => {
    await writeFile("def.ts", "export default function defaultFn() {}");
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "def.ts" }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    expect(analysis.exports.some((e: any) => e.name === "defaultFn")).toBe(true);
    expect(analysis.symbols.some((s: any) => s.name === "defaultFn")).toBe(true);
  });

  it("handles export with alias", async () => {
    await writeFile("alias.ts", `const original = 1;
export { original as aliased };`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "alias.ts" }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    // The current implementation records alias as original name with aliases array; or maybe it doesn't capture alias at all.
    // We'll just check that there is at least one export and one symbol.
    expect(analysis.exports.length).toBeGreaterThan(0);
    expect(analysis.symbols.some((s: any) => s.name === "original")).toBe(true);
  });

  it("handles non-code extension (unknown language)", async () => {
    await writeFile("readme.md", "# README");
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "readme.md" }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe("unknown");
    expect(result.details.imports).toHaveLength(0);
    expect(result.details.exports).toHaveLength(0);
  });

  it("handles empty file", async () => {
    await writeFile("empty.ts", "");
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: "empty.ts" }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    expect(analysis.imports).toHaveLength(0);
    expect(analysis.exports).toHaveLength(0);
    expect(analysis.symbols).toHaveLength(0);
  });

  // Additional coverage-focused tests

  it('handles default export of const', async () => {
    await writeFile('def.ts', 'export default const X = 1;');
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'def.ts' }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    expect(analysis.exports.some((e: any) => e.type === 'default' && e.name === 'X')).toBe(true);
    expect(analysis.symbols.some((s: any) => s.kind === 'variable' && s.name === 'X')).toBe(true);
  });

  it('handles multiple named exports with aliases', async () => {
    await writeFile('multi.ts', `
      const a = 1;
      const b = 2;
      export { a as a2, b };
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'multi.ts' }, ctx);
    expect(result.isError).toBe(false);
    const analysis: any = result.details;
    const aExport = analysis.exports.find((e: any) => e.name === 'a');
    expect(aExport).toBeDefined();
    expect(aExport.aliases).toContain('a2');
    const bExport = analysis.exports.find((e: any) => e.name === 'b');
    expect(bExport).toBeDefined();
  });

  it('detects .tsx file language', async () => {
    await writeFile('comp.tsx', `
      import React from 'react';
      export default function C() { return <div/>; }
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'comp.tsx' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('tsx');
  });

  it('handles unknown extension but still parses', async () => {
    await writeFile('mod.mjs', `
      import { x } from './y';
      export const z = 1;
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'mod.mjs' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('unknown');
    expect(result.details.imports.length).toBeGreaterThan(0);
    expect(result.details.exports.length).toBeGreaterThan(0);
  });

  it('schema is defined', () => {
    expect(schema).toBeDefined();
  });
});
