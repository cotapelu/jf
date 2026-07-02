import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

const analyzeModule = await import('../capabilities/analyze.ts');
const { execute } = analyzeModule;

describe('analyze edge cases (uncovered branches)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'piclaw-analyze-edge-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const writeFile = async (name: string, content: string) => {
    const filePath = join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles empty named import', async () => {
    await writeFile('empty-named.ts', `import {} from 'mod';`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'empty-named.ts' }, ctx);
    expect(result.isError).toBe(false);
  });

  it('handles namespace import', async () => {
    await writeFile('ns.ts', `import * as ns from 'ns-mod';`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'ns.ts' }, ctx);
    expect(result.isError).toBe(false);
  });

  it('handles export * from', async () => {
    await writeFile('reexport.ts', `export * from 'other';`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'reexport.ts' }, ctx);
    expect(result.isError).toBe(false);
  });

  it('handles named export with alias', async () => {
    await writeFile('alias.ts', `export { foo as bar } from 'mod';`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'alias.ts' }, ctx);
    expect(result.isError).toBe(false);
  });

  it('handles empty export braces', async () => {
    await writeFile('empty-export.ts', `export { } ;`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'empty-export.ts' }, ctx);
    expect(result.isError).toBe(false);
  });

  it('handles var declaration', async () => {
    await writeFile('var-decl.ts', `var x = 10;`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'var-decl.ts' }, ctx);
    expect(result.isError).toBe(false);
  });

  it('handles default function export', async () => {
    await writeFile('def-func.ts', `export default function df() {}`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'def-func.ts' }, ctx);
    expect(result.isError).toBe(false);
  });
});
