import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import process from 'process';
import { mkdtemp, rm } from 'fs/promises';
import { execute } from '../capabilities/complexity';

interface ComplexityDetails {
  file: string;
  exists: boolean;
  language: string;
  lines: number;
  functions: number;
  cyclomatic: number;
  halstead: { volume: number; difficulty: number; effort: number; bugs: number };
  maintainability: number;
}

describe('codebase.complexity edge cases', () => {
  let tmpdir: string;

  beforeEach(async () => {
    tmpdir = await mkdtemp('evo-test-complexity-edge-');
  });

  afterEach(async () => {
    await rm(tmpdir, { recursive: true, force: true });
  });

  it('should handle logical operator ?? to cover false branch of DECISION_HANDLERS ternary', async () => {
    const content = 'const x = a ?? b;';
    const file = join(tmpdir, 'nullish.ts');
    await fs.writeFile(file, content, 'utf8');
    const result = await execute({ file: 'nullish.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
  });

  it('should ignore excluded operands (true, false, null, undefined) in Halstead count', async () => {
    const content = `
const flag = true;
const undef = undefined;
const nul = null;
`;
    const file = join(tmpdir, 'excluded.ts');
    await fs.writeFile(file, content, 'utf8');
    const result = await execute({ file: 'excluded.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
  });

  it('should handle destructuring in variable declarator to cover false branch', async () => {
    const content = `const { a, b } = obj;`;
    const file = join(tmpdir, 'destructuring.ts');
    await fs.writeFile(file, content, 'utf8');
    const result = await execute({ file: 'destructuring.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
  });

  it('should handle member expression with non-identifier property (index access)', async () => {
    const content = `arr[0];\nobj['key'];`;
    const file = join(tmpdir, 'member.ts');
    await fs.writeFile(file, content, 'utf8');
    const result = await execute({ file: 'member.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
  });

  it('should handle template literal to trigger node.value undefined branch', async () => {
    const content = `const t = \`hello\`;`;
    const file = join(tmpdir, 'template.ts');
    await fs.writeFile(file, content, 'utf8');
    const result = await execute({ file: 'template.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
  });

  it('should fallback to process.cwd when ctx.cwd is undefined', async () => {
    const content = `export const x = 1;`;
    // Write file to process.cwd() directly
    const cwd = process.cwd();
    const fileName = 'temp-simple-' + Date.now() + '.ts';
    const filePath = join(cwd, fileName);
    await fs.writeFile(filePath, content, 'utf8');
    try {
      // Call without cwd in ctx; it should use process.cwd() and find the file
      const result = await execute({ file: fileName }, {} as any);
      expect(result.isError).toBe(false);
    } finally {
      // Cleanup
      await fs.unlink(filePath).catch(() => {});
    }
  });

  it('should compute cyclomatic complexity > 10 to cover false branch of rating', async () => {
    const lines = [
      'function complex(a: number, b: number, c: number, d: number, e: number, f: number): number {',
      '  let r = 0;',
      '  if (a > 0) {',
      '    r += 1;',
      '    if (b > 0) { r += 2; } else { r -= 2; }',
      '  } else if (a < 0) {',
      '    r -= 1;',
      '  } else {',
      '    r = 0;',
      '  }',
      '  switch (c) {',
      '    case 1: r += 1; break;',
      '    case 2: r += 2; break;',
      '    default: r += 3;',
      '  }',
      '  for (let i = 0; i < d; i++) {',
      '    r += i;',
      '    if (i % 2 === 0) continue;',
      '  }',
      '  while (e > 0) {',
      '    e--;',
      '    if (e === 5) break;',
      '  }',
      '  do {',
      '    f--;',
      '  } while (f > 0);',
      '  return r;',
      '}',
      'export { complex };'
    ];
    const content = lines.join('\n');
    const file = join(tmpdir, 'complex.ts');
    await fs.writeFile(file, content, 'utf8');
    const result = await execute({ file: 'complex.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBeGreaterThan(10);
  });

  it('should achieve maintainability >= 85 for very simple file', async () => {
    const content = `export const x = 1;`;
    const file = join(tmpdir, 'minimal.ts');
    await fs.writeFile(file, content, 'utf8');
    const result = await execute({ file: 'minimal.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.maintainability).toBeGreaterThanOrEqual(85);
  });
});
