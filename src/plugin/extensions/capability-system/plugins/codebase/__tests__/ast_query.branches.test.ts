#!/usr/bin/env node
/**
 * Branch coverage for codebase.ast_query
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

const astQueryModule = await import('../capabilities/ast_query.ts');
const { execute } = astQueryModule;

describe('ast_query branch coverage', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'piclaw-ast-'));
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

  it('handles parse error in AST', async () => {
    await writeFile('bad.ts', 'class'); // invalid syntax
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'bad.ts', query: { kind: 'function' } }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Parse error/);
  });

  it('handles file not found (access fails)', async () => {
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'nonexistent.ts', query: { kind: 'function' } }, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.exists).toBe(false);
    expect(result.content[0].text).toMatch(/File not found/);
  });

  it('handles readFile error by throwing', async () => {
    await writeFile('a.ts', `function foo() {}`);
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('read failed'));
    const ctx = { cwd: tempDir } as any;
    await expect(execute({ file: 'a.ts', query: { kind: 'function' } }, ctx)).rejects.toThrow('read failed');
  });

  it('enforces result limit correctly', async () => {
    const funcs = Array.from({ length: 10 }, (_, i) => `function func${i}() {}`).join('\n');
    await writeFile('many.ts', funcs);
    const ctx = { cwd: tempDir } as any;

    const resultNoLimit = await execute({ file: 'many.ts', query: { kind: 'function' } }, ctx);
    expect(resultNoLimit.details.matches.length).toBe(10);

    const resultLimit3 = await execute({ file: 'many.ts', query: { kind: 'function', limit: 3 } }, ctx);
    expect(resultLimit3.details.matches.length).toBe(3);
  });

  it('filters by exact name match', async () => {
    await writeFile('a.ts', `
      function alpha() {}
      function beta() {}
      function gamma() {}
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: { kind: 'function', name: 'beta' } }, ctx);
    expect(result.details.matches).toHaveLength(1);
    expect(result.details.matches[0].name).toBe('beta');
  });

  it('filters by regex pattern', async () => {
    await writeFile('a.ts', `
      function alpha() {}
      function beta() {}
      function gammaBig() {}
    `);
    const ctx = { cwd: tempDir } as any;
    // Pattern: 4 or 5 word characters (matches alpha (5) and beta (4), not gammaBig (9))
    const result = await execute({ file: 'a.ts', query: { kind: 'function', name: '^\\w{4,5}$' } }, ctx);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
    expect(names).not.toContain('gammaBig');
  });

  it('handles invalid regex falling back to equality', async () => {
    await writeFile('a.ts', `
      function foo() {}
      function bar() {}
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: { kind: 'function', name: '[' } }, ctx);
    // Invalid regex, nameMatches returns name === pattern -> false for both, so no matches
    expect(result.details.matches).toHaveLength(0);
  });

  it('filters by parent class for methods', async () => {
    await writeFile('a.ts', `
      class MyClass {
        methodA() {}
        methodB() {}
      }
      function topFunc() {}
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: { kind: 'function', parent: 'MyClass' } }, ctx);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain('methodA');
    expect(names).toContain('methodB');
    expect(names).not.toContain('topFunc');
  });

  it('applies both name and parent filters', async () => {
    await writeFile('a.ts', `
      class MyClass {
        myMethod() {}
        otherMethod() {}
      }
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: { kind: 'function', parent: 'MyClass', name: 'myMethod' } }, ctx);
    expect(result.details.matches).toHaveLength(1);
    expect(result.details.matches[0].name).toBe('myMethod');
  });

  it('queries import statements', async () => {
    await writeFile('a.ts', `
      import fs from 'fs';
      import { readFile } from 'fs/promises';
      import './local';
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: { kind: 'import' } }, ctx);
    expect(result.details.matches.length).toBeGreaterThanOrEqual(3);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain('fs');
    expect(names).toContain('fs/promises');
    expect(names).toContain('./local');
  });

  it('queries export statements', async () => {
    await writeFile('a.ts', `
      export const x = 1;
      export function foo() {}
      export default 42;
      export * from './other';
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: { kind: 'export' } }, ctx);
    const names = result.details.matches.map(m => m.name);
    expect(names).toContain('x');
    expect(names).toContain('foo');
    expect(names).toContain('default');
    expect(names).toContain('*');
  });

  it('handles no matches gracefully', async () => {
    await writeFile('a.ts', `function foo() {}`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: { kind: 'class' } }, ctx);
    expect(result.details.matches).toHaveLength(0);
    expect(result.isError).toBe(false);
  });
});
