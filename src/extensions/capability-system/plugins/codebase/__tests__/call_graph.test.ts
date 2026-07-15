#!/usr/bin/env node
/**
 * Tests for codebase.call_graph capability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, unlink, mkdtemp, rm } from "fs/promises";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp files
async function writeTempFile(content: string, ext = "ts", subdir?: string): Promise<string> {
  const timestamp = Date.now();
  const baseDir = subdir ? path.join(__dirname, "temp", subdir) : path.join(__dirname, "temp");
  await mkdir(baseDir, { recursive: true });
  const file = path.join(baseDir, `call-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

// Import call_graph capability
const callGraphModule = await import("../capabilities/call_graph.ts");

// Type for result details
interface CallGraphDetails {
  file: string;
  entryPoints?: string[];
  query: Record<string, unknown>;
  result: {
    nodes: Array<{ name: string; file: string; line: number }>;
    edges: Array<{ from: { name: string; file: string }, to: { name: string; file: string } }>;
    stats: { nodeCount: number; edgeCount: number };
  };
}

describe("codebase.call_graph", () => {
  afterEach(async () => {
    // Cleanup not strictly needed; temp files overwritten with timestamp
  });

  it("should handle missing file", async () => {
    const ctx = { cwd: __dirname };
    const result = await callGraphModule.execute({ file: "nonexistent.ts", query: {} }, ctx as { cwd: string });

    expect(result.isError).toBe(false); // Currently we just return empty graph for missing files
    expect(result.details.result.nodes.length).toBe(0);
  });

  it("should handle parse error", async () => {
    const code = `function foo() {
  return (`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: {} }, ctx as { cwd: string });

    expect(result.isError).toBe(false); // Graceful: empty graph
    expect(result.details.result.nodes.length).toBe(0);
    expect(result.details.result.edges.length).toBe(0);

    await unlink(file);
  });

  it("should build simple call graph within one file", async () => {
    const code = "function a() { b(); }\nfunction b() { c(); }\nfunction c() {}";
    const file = await writeTempFile(code), ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: { includeCrossFile: false } }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes, edges = result.details.result.edges;
    expect(nodes.length).toBe(3);
    expect(edges.length).toBe(2);
    const edgeNames = edges.map(e => `${e.from.name}->${e.to.name}`).sort();
    expect(edgeNames).toEqual(["a->b", "b->c"]);
    await unlink(file);
  });

  it("should filter edges by callee name pattern", async () => {
    const code = `
function foo() { bar(); baz(); }
function bar() {}
function baz() {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: { name: "bar", includeCrossFile: false } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.result.edges.length).toBe(1);
    expect(result.details.result.edges[0].to.name).toBe("bar");

    await unlink(file);
  });

  it("should respect limit", async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `func${i}()`).join('; ');
    const code = `function caller() { ${lines} }` + Array.from({ length: 10 }, (_, i) => `function func${i}() {}`).join('\n');
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: { limit: 5, includeCrossFile: false } }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    expect(result.details.result.edges.length).toBe(5);

    await unlink(file);
  });

  it("should build cross-file call graph with simple import", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "callgraph-cross-")), libFile = path.join(dir, "lib.ts"), mainFile = path.join(dir, "main.ts");
    await Promise.all([writeFile(libFile, "export function callee() {}", "utf-8"), writeFile(mainFile, "import { callee } from \"./lib\"; function main() { callee(); }", "utf-8")]);
    const result = await callGraphModule.execute({ file: "main.ts", query: { includeCrossFile: true, depth: 1 } }, { cwd: dir } as { cwd: string });
    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes.map(n => n.name);
    expect(nodes).toContain("main");
    expect(nodes).toContain("callee");
    expect(result.details.result.edges).toHaveLength(1);
    expect(result.details.result.edges[0].from.name).toBe("main");
    expect(result.details.result.edges[0].to.name).toBe("callee");
    await Promise.all([unlink(libFile), unlink(mainFile), rm(dir, { recursive: true, force: true })]);
  });

  it('filters reachable subgraph with entryPoints', async () => {
    const codes = { a: "export function a() {}", b: "import { a } from './a'; export function b() { a(); }", c: "import { b } from './b'; export function c() { b(); }", d: "import { c } from './c'; export function d() { c(); }" };
    const dir = await mkdtemp(path.join(os.tmpdir(), 'callgraph-ep-'));
    await Promise.all(Object.entries(codes).map(([name, code]) => writeFile(path.join(dir, name+'.ts'), code)));
    const exec = (params) => callGraphModule.execute({ file: params.file, entryPoints: params.entryPoints, query: { includeCrossFile: true, depth: 10 } }, { cwd: dir } as { cwd: string });
    const check = async (file, entryPoints, expected) => {
      const res = await exec({ file, entryPoints });
      expect(res.isError).toBe(false);
      expect(res.details.result.nodes.map(n => n.name).sort()).toEqual(expected);
    };
    await check('a.ts', [], ['a']);
    await check('a.ts', ['b.ts'], ['a','b']);
    await check('a.ts', ['a.ts','c.ts'], ['a','b','c']);
    await Promise.all(['a.ts','b.ts','c.ts','d.ts'].map(f => unlink(path.join(dir, f)).catch(()=>{})));
    await rm(dir, { recursive: true, force: true });
  });

  it('handles entryPoints that do not exist', async () => {
    const code = `export function x() {}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'callgraph-missing-'));
    await writeFile(path.join(dir, 'a.ts'), code);

    const result = await callGraphModule.execute({ file: 'a.ts', entryPoints: ['missing.ts'], query: { includeCrossFile: false, depth: 1 } }, { cwd: dir } as { cwd: string });
    expect(result.isError).toBe(false);
    // Should still include a from main file
    expect(result.details.result.nodes.map(n => n.name)).toContain('x');

    await unlink(path.join(dir, 'a.ts'));
    await rm(dir, { recursive: true, force: true });
  });

  it("should handle depth limit", async () => {
    const codes = { libC: "export function c() {}", libD: "export function d() {}", libB: "import { c } from \"./libC\"; export function b() { c(); }", libA: "import { b } from \"./libB\"; export function a() { b(); }" };
    const dir = await mkdtemp(path.join(os.tmpdir(), "callgraph-depth-"));
    await Promise.all(Object.entries(codes).map(([name, code]) => writeFile(path.join(dir, name+'.ts'), code)));
    const result = await callGraphModule.execute({ file: "libA.ts", query: { includeCrossFile: true, depth: 2 } }, { cwd: dir } as { cwd: string });
    expect(result.isError).toBe(false);
    const names = result.details.result.nodes.map(n => n.name).sort();
    expect(names).toEqual(["a", "b", "c"]);
    await Promise.all(Object.keys(codes).map(k => unlink(path.join(dir, k+'.ts')).catch(()=>{})));
    await rm(dir, { recursive: true, force: true });
  });

  it("should not duplicate nodes", async () => {
    // two files import same function from same lib
    const lib = `export function shared() {}`;
    const a = `import { shared } from "./lib"; function a() { shared(); }`;
    const b = `import { shared } from "./lib"; function b() { shared(); }`;
    const dir = await mkdtemp(path.join(os.tmpdir(), "callgraph-dup-"));
    await writeFile(path.join(dir, "lib.ts"), lib);
    await writeFile(path.join(dir, "a.ts"), a);
    await writeFile(path.join(dir, "b.ts"), b);

    const result = await callGraphModule.execute({ file: "a.ts", query: { includeCrossFile: true, depth: 1 } }, { cwd: dir } as { cwd: string });

    expect(result.isError).toBe(false);
    // shared should appear once
    const sharedNodes = result.details.result.nodes.filter(n => n.name === "shared");
    expect(sharedNodes.length).toBe(1);

    // Cleanup
    for (const f of ["lib.ts", "a.ts", "b.ts"]) {
      try { await unlink(path.join(dir, f)); } catch {}
    }
    await rm(dir, { recursive: true, force: true });
  });
});
