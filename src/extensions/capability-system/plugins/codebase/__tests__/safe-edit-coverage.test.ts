import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import safeEditModule from '../capabilities/safe_edit.js';

describe('safe_edit coverage gaps', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jf-sec-'));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (e) {}
  });

  function createMockCtx() {
    return {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => {
        if (cmd === 'npx' && args[0] === 'tsc') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'eslint') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'prettier') return { code: 0, stdout: '', stderr: '' };
        return { code: 0, stdout: '', stderr: '' };
      },
    };
  }

  it('should accept tsc exit code 2 (diagnostics) as success', async () => {
    const file = join(tempDir, 'a.ts');
    await writeFile(file, 'original', 'utf-8');

    const ctx = createMockCtx();
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === 'npx' && args[0] === 'tsc') {
        return { code: 2, stdout: '', stderr: 'diagnostics' }; // non-zero but allowed
      }
      return { code: 0, stdout: '', stderr: '' };
    };

    const params = {
      operations: [{ file: 'a.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'changed' }],
      format: false,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(true);
    expect(result.results[0].success).toBe(true);
  });

  it('should handle backupFiles read error', async () => {
    const file = join(tempDir, 'missing.ts');
    // Do not create the original file

    const ctx = createMockCtx();
    // backupFiles will try to read original; let fs readFile fail naturally

    const params = {
      operations: [{ file: 'missing.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'new' }],
      format: false,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('Cannot read file missing.ts');
  });

  it('should handle computeFinalContents edit failure', async () => {
    const file = join(tempDir, 'bad-edit.ts');
    await writeFile(file, 'original', 'utf-8');

    const ctx = createMockCtx();

    // editing: replace range start > end causes error
    const params = {
      operations: [{ file: 'bad-edit.ts', editType: 'replace' as const, range: { start: 5, end: 2 }, newCode: 'bad' }],
      format: false,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('Edit failed in bad-edit.ts');
  });
});
