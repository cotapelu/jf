import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
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
    // Mock prettier to fail
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === 'npx' && args[0] === 'prettier') {
        return { code: 1, stdout: '', stderr: 'prettier error' };
      }
      if (cmd === 'npx' && args[0] === 'tsc') {
        return { code: 0, stdout: '', stderr: '' };
      }
      return { code: 0, stdout: '', stderr: '' };
    };

    const params = {
      operations: [{ file: 'bad.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'new' }],
      format: true,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('prettier');
  });

  it('should succeed with fixImports=false and format=false', async () => {
    const file = join(tempDir, 'x.ts');
    await writeFile(file, 'code', 'utf-8');

    const ctx = createMockCtx();
    // Track whether eslint/prettier were called
    let eslintCalled = false;
    let prettierCalled = false;
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === 'npx' && args[0] === 'eslint') {
        eslintCalled = true;
        return { code: 0, stdout: '', stderr: '' };
      }
      if (cmd === 'npx' && args[0] === 'prettier') {
        prettierCalled = true;
        return { code: 0, stdout: '', stderr: '' };
      }
      if (cmd === 'npx' && args[0] === 'tsc') {
        return { code: 0, stdout: '', stderr: '' };
      }
      return { code: 0, stdout: '', stderr: '' };
    };

    const params = {
      operations: [{ file: 'x.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'changed' }],
      format: false,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(true);
    expect(eslintCalled).toBe(false);
    expect(prettierCalled).toBe(false);
    const content = await readFile(file, 'utf-8');
    expect(content).toBe('changed');
  });
});
