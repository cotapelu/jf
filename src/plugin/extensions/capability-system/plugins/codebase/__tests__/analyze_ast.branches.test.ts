#!/usr/bin/env node
/**
 * Branch coverage for codebase.analyze_ast
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

const analyzeAstModule = await import('../capabilities/analyze_ast.ts');
const { execute } = analyzeAstModule;

describe('analyze_ast branch coverage', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'analyzeast-branch-'));
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

  it('handles readFile error', async () => {
    await writeFile('a.ts', `const x = 1;`);
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('disk error'));
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Parse error.*disk error/);
  });

  it('detects language: ts for .ts files', async () => {
    await writeFile('a.ts', `const x = 1;`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('ts');
  });

  it('detects language: tsx for .tsx files', async () => {
    await writeFile('a.tsx', `const x = 1;`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.tsx' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('tsx');
  });

  it('detects language: js for .js files', async () => {
    await writeFile('a.js', `const x = 1;`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.js' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('js');
  });

  it('detects language: jsx for .jsx files', async () => {
    await writeFile('a.jsx', `const x = 1;`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.jsx' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('jsx');
  });

  it('detects language: unknown for unrecognized extension', async () => {
    await writeFile('a.unknown', `const x = 1;`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.unknown' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('unknown');
  });

  it('captures TS enum declaration', async () => {
    await writeFile('a.ts', `enum Color { Red, Green, Blue }`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts' }, ctx);
    expect(result.isError).toBe(false);
    const enumSymbol = result.details.symbols.find(s => s.kind === 'enum' && s.name === 'Color');
    expect(enumSymbol).toBeDefined();
  });

  it('captures const/let variable kinds', async () => {
    await writeFile('a.ts', `
      const x = 1;
      let y = 2;
      var z = 3;
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts' }, ctx);
    expect(result.isError).toBe(false);
    const constSym = result.details.symbols.find(s => s.name === 'x');
    const letSym = result.details.symbols.find(s => s.name === 'y');
    const varSym = result.details.symbols.find(s => s.name === 'z');
    expect(constSym?.kind).toBe('const');
    expect(letSym?.kind).toBe('let');
    expect(varSym?.kind).toBe('variable');
  });

  it('captures type alias and interface', async () => {
    await writeFile('a.ts', `
      type MyType = string;
      interface MyInterface { foo: number; }
    `);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts' }, ctx);
    expect(result.isError).toBe(false);
    const typeSym = result.details.symbols.find(s => s.kind === 'type' && s.name === 'MyType');
    const ifaceSym = result.details.symbols.find(s => s.kind === 'interface' && s.name === 'MyInterface');
    expect(typeSym).toBeDefined();
    expect(ifaceSym).toBeDefined();
  });

  it('captures re-exported symbols', async () => {
    await writeFile('b.ts', `export const b = 2;`);
    await writeFile('a.ts', `export { b } from './b';`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts' }, ctx);
    expect(result.isError).toBe(false);
    const exportInfo = result.details.exports.find(e => e.name === 'b');
    expect(exportInfo).toBeDefined();
  });
});
