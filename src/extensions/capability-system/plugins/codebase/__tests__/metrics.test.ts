import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { execute } from '../capabilities/metrics';

describe('codebase.metrics', () => {
  let tmpdir: string;

  beforeEach(async () => {
    tmpdir = await mkdtemp('evo-test-metrics-');
  });

  it('should compute metrics for a simple TypeScript file', async () => {
    const fileRel = 'sample.ts';
    const content = `
import { foo } from './bar';
export const x = 1;
function myFunc(a: number, b: number): number {
  return a + b;
}
class MyClass {
  prop: string;
  method() {}
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ files: [fileRel] }, { cwd: tmpdir });
    expect(result.stats.totalFiles).toBe(1);
    expect(result.results).toHaveLength(1);
    const metrics = result.results[0];
    expect(metrics.error).toBeUndefined();
    expect(metrics.lines).toBeGreaterThan(0);
    expect(metrics.imports).toBe(1);
    expect(metrics.exports).toBeGreaterThanOrEqual(1);
    expect(metrics.functions).toBeGreaterThanOrEqual(1);
    expect(metrics.classes).toBeGreaterThanOrEqual(1);
    // stats aggregation
    expect(result.stats.totalImports).toBe(metrics.imports);
    expect(result.stats.totalFunctions).toBe(metrics.functions);
    expect(result.stats.totalClasses).toBe(metrics.classes);
  });

  it('should handle multiple files and aggregate stats', async () => {
    const file1 = 'a.ts';
    const file2 = 'b.ts';
    const content1 = `
import x from 'x';
function f1() {}
class C1 {}
`;
    const content2 = `
import y from 'y';
function f2() {}
class C2 {}
`;
    await fs.writeFile(join(tmpdir, file1), content1, 'utf8');
    await fs.writeFile(join(tmpdir, file2), content2, 'utf8');

    const result = await execute({ files: [file1, file2] }, { cwd: tmpdir });
    expect(result.stats.totalFiles).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.stats.totalImports).toBe(2);
    expect(result.stats.totalFunctions).toBe(2);
    expect(result.stats.totalClasses).toBe(2);
  });

  it('should return error for missing file', async () => {
    const result = await execute({ files: ['nonexistent.ts'] }, { cwd: tmpdir });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].error).toContain('ENOENT');
    expect(result.stats.totalFiles).toBe(1);
    // stats should be zeroed
    expect(result.stats.totalLines).toBe(0);
    expect(result.stats.totalFunctions).toBe(0);
  });

  it('should handle empty file', async () => {
    const fileRel = 'empty.ts';
    await fs.writeFile(join(tmpdir, fileRel), '', 'utf8');

    const result = await execute({ files: [fileRel] }, { cwd: tmpdir });
    expect(result.results).toHaveLength(1);
    const m = result.results[0];
    expect(m.error).toBeUndefined();
    expect(m.lines).toBe(1); // one empty line or 0? split('\n') on empty string gives [''] -> 1 line.
    expect(m.functions).toBe(0);
    expect(m.classes).toBe(0);
    expect(m.imports).toBe(0);
    expect(m.exports).toBe(0);
  });

  it('should handle parse error gracefully', async () => {
    const fileRel = 'bad.ts';
    await fs.writeFile(join(tmpdir, fileRel), 'invalid syntax <<<', 'utf8');

    const result = await execute({ files: [fileRel] }, { cwd: tmpdir });
    expect(result.results).toHaveLength(1);
    const m = result.results[0];
    expect(m.error).toMatch(/Parsing error|Unexpected/);
    expect(m.lines).toBe(0);
    expect(m.functions).toBe(0);
    expect(m.classes).toBe(0);
  });
});
