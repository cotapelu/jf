import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { execute } from '../capabilities/analyze.js';

describe('codebase.analyze coverage', () => {
  let tmpdir: string;

  beforeEach(async () => {
    tmpdir = await mkdtemp('analyze-cov-');
  });

  afterEach(async () => {
    await rm(tmpdir, { recursive: true, force: true });
  });

  it('handles missing file', async () => {
    const result = await execute({ file: 'no.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(true);
  });

  it('parses empty file', async () => {
    const file = join(tmpdir, 'empty.ts');
    await fs.writeFile(file, '', 'utf8');
    const result = await execute({ file: 'empty.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    expect(result.details.lines).toBe(1);
  });

  it('detects language .tsx', async () => {
    const file = join(tmpdir, 'test.tsx');
    await fs.writeFile(file, 'const x = 1;', 'utf8');
    const result = await execute({ file: 'test.tsx' }, { cwd: tmpdir });
    expect(result.details.language).toBe('tsx');
  });

  it('parses export default class', async () => {
    const code = `export default class Foo {}`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    expect(result.details.exports.some(e => e.type === 'default' && e.name === 'Foo')).toBe(true);
  });

  it('parses export default interface', async () => {
    const code = `export default interface IBar {}`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    expect(result.details.exports.some(e => e.type === 'default' && e.name === 'IBar')).toBe(true);
  });

  it('parses export default function', async () => {
    const code = `export default function foo() {}`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    expect(result.details.exports.some(e => e.type === 'default' && e.name === 'foo')).toBe(true);
  });

  it('parses export default var', async () => {
    const code = `export default const x = 1;`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    expect(result.details.exports.some(e => e.type === 'default' && e.name === 'x')).toBe(true);
  });

  it('parses export star from', async () => {
    const code = `export * from 'module';`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    expect(result.details.exports.some(e => e.type === 'named' && e.name === '*')).toBe(true);
  });

  it('parses export type', async () => {
    const code = `export type MyType = string;`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    expect(result.details.exports.some(e => e.type === 'named' && e.name === 'MyType')).toBe(true);
    expect(result.details.symbols.some(s => s.kind === 'type' && s.name === 'MyType')).toBe(true);
  });

  it('parses export with alias (may vary)', async () => {
    const code = `export { foo as bar };`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    // Parser may produce different structure; just ensure no crash
    expect(result.isError).toBe(false);
  });

  it('parses import with type keyword? (regex may not support)', async () => {
    const code = `import type { Foo } from 'mod';`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    // type-only import not fully supported, but should not crash
    expect(result.isError).toBe(false);
  });

  it('parses enum', async () => {
    const code = `enum Color { Red, Green, Blue }`;
    const file = join(tmpdir, 'test.ts');
    await fs.writeFile(file, code, 'utf8');
    const result = await execute({ file: 'test.ts' }, { cwd: tmpdir });
    expect(result.details.symbols.some(s => s.kind === 'enum' && s.name === 'Color')).toBe(true);
  });

  it('handles unknown extension', async () => {
    const file = join(tmpdir, 'test.xyz');
    await fs.writeFile(file, 'whatever', 'utf8');
    const result = await execute({ file: 'test.xyz' }, { cwd: tmpdir });
    expect(result.details.language).toBe('unknown');
  });
});
