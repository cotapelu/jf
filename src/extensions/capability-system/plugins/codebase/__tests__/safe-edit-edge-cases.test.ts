import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import safeEditModule from '../capabilities/safe_edit.js';

describe('safe_edit edge cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jf-safe-edit-'));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (e) {}
  });

  function createMockCtx() {
    return {
      cwd: tempDir,
      exec: async (cmd: string, args: string[], opts?: any) => {
        // Default: all commands succeed
        if (cmd === 'npx' && args[0] === 'tsc') {
          return { code: 0, stdout: '', stderr: '' };
        }
        if (cmd === 'npx' && args[0] === 'eslint') {
          return { code: 0, stdout: '', stderr: '' };
        }
        if (cmd === 'npx' && args[0] === 'prettier') {
          return { code: 0, stdout: '', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      },
    };
  }

  it('should handle prettier failure (non-zero exit)', async () => {
    const file = join(tempDir, 'bad.ts');
    await writeFile(file, 'code', 'utf-8');
    let ctx = createMockCtx();
    ctx.exec = async (cmd, args) => {
      if (cmd === 'npx' && args[0] === 'prettier') return { code: 1, stdout: '', stderr: 'prettier error' };
      if (cmd === 'npx' && args[0] === 'tsc') return { code: 0, stdout: '', stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    };
    const params = { operations: [{ file: 'bad.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'new' }], format: true, fixImports: false };
    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('prettier');
  });

  it('should not call eslint when fixImports=false', async () => {
    const file = join(tempDir, 'no-fix.ts');
    await writeFile(file, 'code', 'utf-8');
    const ctx = createMockCtx();
    let eslintCalled = false;
    ctx.exec = async (cmd, args) => {
      if (cmd === 'npx' && args[0] === 'eslint') { eslintCalled = true; return { code: 0, stdout: '', stderr: '' }; }
      if (cmd === 'npx' && args[0] === 'tsc') return { code: 0, stdout: '', stderr: '' };
      return { code: 0, stdout: '' };
    };
    const params = { operations: [{ file: 'no-fix.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'new' }], format: false, fixImports: false };
    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(true);
    expect(eslintCalled).toBe(false);
  });

  it('should throw when fs.writeFile fails', async () => {
    const file = join(tempDir, 'c.ts');
    await writeFile(file, 'original', 'utf-8');
    const writeError = new Error('disk full');
    const writeSpy = vi.spyOn(fs, 'writeFile').mockRejectedValue(writeError);
    const ctx = createMockCtx();
    const params = {
      operations: [{ file: 'c.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'new' }],
      format: false,
      fixImports: false,
    };
    // execute should reject with the writeFile error (no try/catch around writeFiles)
    await expect(safeEditModule.execute(params, ctx as any)).rejects.toThrow('disk full');
    writeSpy.mockRestore();
  });
});
