#!/usr/bin/env node
/**
 * Additional safe_edit branch coverage tests (Round 206+)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, unlink, mkdtemp, rm } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function writeTempFile(content: string, ext = 'ts'): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, 'temp');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `safe-${timestamp}.${ext}`);
  await writeFile(file, content, 'utf-8');
  return file;
}

const safeEditModule = await import('../capabilities/safe_edit.ts');

describe('safe_edit Additional Coverage', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'safe-edit-add-'));
  });
  afterEach(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  function createMockCtx(cwd: string) {
    return {
      cwd,
      exec: async (cmd: string, args: string[], opts?: any) => {
        // default: success for tsc, eslint, prettier
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
      }
    };
  }

  it('should handle empty operations array', async () => {
    const ctx = createMockCtx(tempDir);
    const params = {
      operations: [],
      format: false,
      fixImports: false
    };
    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it('should handle non-Error thrown during validation', async () => {
    const file = path.join(tempDir, 'sample.ts');
    await writeFile(file, 'code', 'utf-8');
    const ctx = createMockCtx(tempDir);

    // Make ctx.exec throw a non-Error (string)
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === 'npx' && args[0] === 'tsc') {
        throw 'tsc exploded';
      }
      return { code: 0, stdout: '', stderr: '' };
    };

    const params = {
      operations: [{
        file: 'sample.ts',
        editType: 'replace' as const,
        range: { start: 0, end: 1 },
        newCode: 'new'
      }],
      format: false,
      fixImports: false
    };

    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain('tsc exploded');
  });

  it('should handle rollback when multiple operations and validation fails on second file', async () => {
    const file1 = path.join(tempDir, 'a.ts');
    const file2 = path.join(tempDir, 'b.ts');
    await writeFile(file1, 'orig1', 'utf-8');
    await writeFile(file2, 'orig2', 'utf-8');
    const ctx = createMockCtx(tempDir);

    // Make tsc fail on b.ts only
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === 'npx' && args[0] === 'tsc') {
        if (args.includes('b.ts')) {
          return { code: 1, stdout: '', stderr: 'error in b' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }
      return { code: 0, stdout: '', stderr: '' };
    };

    const params = {
      operations: [
        { file: 'a.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'changed1' },
        { file: 'b.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'changed2' }
      ],
      format: false,
      fixImports: false
    };

    const result = await safeEditModule.execute(params, ctx as { cwd: string });
    expect(result.success).toBe(false);
    // a.ts should not be changed because rolled back
    const contentA = await readFile(file1, 'utf-8');
    expect(contentA).toBe('orig1');
    // b.ts also remains original since edit didn't persist
    const contentB = await readFile(file2, 'utf-8');
    expect(contentB).toBe('orig2');
    // results: first should be failure due to rollback marker? Actually after catch, all previous results are marked as failure and backupRestored true.
    // result.results length should be 2
    expect(result.results).toHaveLength(2);
  });
});
