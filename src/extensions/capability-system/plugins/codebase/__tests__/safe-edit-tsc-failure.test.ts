import { describe, it, expect } from 'vitest';
import safeEdit from '../capabilities/safe_edit.ts';
import { join } from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';

describe('safe_edit tsc failure coverage', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp('safe-edit-tsc-');
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should fail when tsc exit code is 3 (non-zero, non-2)', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'const x: number = "string";', 'utf8'); // type error to trigger tsc
    const params = {
      operations: [{
        file: 'sample.ts',
        editType: 'replace' as const,
        range: { start: 1, end: 1 },
        newCode: 'const x = "string";'
      }],
      format: false,
      fixImports: false
    };
    const ctx = {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => {
        if (cmd === 'npx' && args[0] === 'tsc') {
          return { code: 3, stdout: '', stderr: 'Type error from tsc' };
        }
        if (cmd === 'npx' && args[0] === 'prettier') {
          return { code: 0, stdout: '', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }
    };
    const result = await safeEdit.execute(params, ctx);
    if (result.success) {
      throw new Error('Expected failure but got success: ' + JSON.stringify(result.results));
    }
    expect(result.results[0].error?.toLowerCase()).toMatch(/tsc|typescript|exit 3/);
  });

  it('should succeed when tsc exit code is 2 (diagnostics ok)', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'console.log("hi");', 'utf8');
    const params = {
      operations: [{
        file: 'sample.ts',
        editType: 'replace' as const,
        range: { start: 1, end: 1 },
        newCode: 'console.log("hello");'
      }],
      format: false,
      fixImports: false
    };
    const ctx = {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => {
        if (cmd === 'npx' && args[0] === 'tsc') {
          return { code: 2, stdout: '', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }
    };
    const result = await safeEdit.execute(params, ctx);
    expect(result.success).toBe(true);
  });
});
