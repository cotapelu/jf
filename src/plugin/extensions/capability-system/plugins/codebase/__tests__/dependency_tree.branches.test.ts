#!/usr/bin/env node
/**
 * Branch coverage for codebase.dependency_tree
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

const depTreeModule = await import('../capabilities/dependency_tree.ts');
const { execute } = depTreeModule;

describe('dependency_tree branch coverage', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'dep-tree-branch-'));
    process.chdir(tempDir);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    vi.restoreAllMocks();
  });

  const writeFile = async (name: string, content: string) => {
    const filePath = join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles parse error in file', async () => {
    await writeFile('bad.ts', 'function ('); // invalid syntax causing parse error
    const result = await execute({ files: ['bad.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Parse error.*bad\.ts/);
  });

  it('handles readFile error', async () => {
    await writeFile('a.ts', `export const x = 1;`);
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('fs read failed'));
    const result = await execute({ files: ['a.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Error processing file a\.ts/);
  });

  it('handles import from external package (ignored)', async () => {
    await writeFile('a.ts', `import _ from 'lodash'; export const x = 1;`);
    await writeFile('b.ts', `export const y = 2;`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const externalEdge = result.details.edges.find(e => e.to.includes('lodash') || e.from.includes('lodash'));
    expect(externalEdge).toBeUndefined();
  });

  it('handles import from missing local file (edge not created)', async () => {
    await writeFile('a.ts', `import { x } from './missing'; export const y = 2;`);
    const result = await execute({ files: ['a.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    expect(result.details.edges.length).toBe(0);
  });

  it('deduplicates cycles of same nodes', async () => {
    await writeFile('a.ts', `import { x } from './b'; export const a = 1;`);
    await writeFile('b.ts', `import { y } from './a'; export const b = 2;`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const cycles = result.details.cycles;
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(cycles[0].length).toBe(3);
  });

  it('handles default import', async () => {
    await writeFile('b.ts', `export const b = 1;`);
    await writeFile('a.ts', `import x from './b';`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const nodeA = result.details.nodes.find((n: any) => n.file.endsWith('a.ts'));
    expect(nodeA?.imports).toContain('b.ts');
  });

  it('handles namespace import', async () => {
    await writeFile('b.ts', `export const b = 1;`);
    await writeFile('a.ts', `import * as ns from './b';`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const nodeA = result.details.nodes.find((n: any) => n.file.endsWith('a.ts'));
    expect(nodeA?.imports).toContain('b.ts');
    const edge = result.details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(edge?.symbols).toContain('*');
  });

  it('handles type-only import', async () => {
    await writeFile('b.ts', `export type T = string;`);
    await writeFile('a.ts', `import type { T } from './b';`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const nodeA = result.details.nodes.find((n: any) => n.file.endsWith('a.ts'));
    expect(nodeA?.imports).toContain('b.ts');
  });

  it('handles variable export const/let/var', async () => {
    await writeFile('a.ts', `
      export const c = 1;
      export let l = 2;
      export var v = 3;
    `);
    const result = await execute({ files: ['a.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const nodeA = result.details.nodes.find((n: any) => n.file.endsWith('a.ts'));
    expect(nodeA?.exports).toContain('c');
    expect(nodeA?.exports).toContain('l');
    expect(nodeA?.exports).toContain('v');
  });

  it('handles function and class exports', async () => {
    await writeFile('a.ts', `
      export function foo() {}
      export class Bar {}
    `);
    const result = await execute({ files: ['a.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const nodeA = result.details.nodes.find((n: any) => n.file.endsWith('a.ts'));
    expect(nodeA?.exports).toContain('foo');
    expect(nodeA?.exports).toContain('Bar');
  });

  it('handles default export', async () => {
    await writeFile('a.ts', `export default 42;`);
    const result = await execute({ files: ['a.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const nodeA = result.details.nodes.find((n: any) => n.file.endsWith('a.ts'));
    expect(nodeA?.exports).toContain('default');
  });

  it('handles re-export from another file', async () => {
    await writeFile('b.ts', `export const b = 2;`);
    await writeFile('a.ts', `export { b } from './b';`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const nodeA = result.details.nodes.find((n: any) => n.file.endsWith('a.ts'));
    expect(nodeA?.exports).toContain('b');
  });

  it('handles export all from another file', async () => {
    await writeFile('b.ts', `export const b = 2;`);
    await writeFile('a.ts', `export * from './b';`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const edge = result.details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(edge).toBeDefined();
    expect(edge?.symbols).toContain('*');
  });
});
