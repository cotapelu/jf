import { describe, it, expect } from 'vitest';
import safeEdit from '../capabilities/safe_edit.ts';
import { join } from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';

describe('safe_edit editType branches', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp('safe-edit-edittypes-');
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should handle insert operation successfully', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'line1\nline2', 'utf8');
    const params = { operations: [{ file: 'sample.ts', editType: 'insert' as const, range: { start: 1, end: 1 }, newCode: 'INSERTED' }], format: false, fixImports: false };
    const ctx = { cwd: tempDir, exec: async () => ({ code: 0, stdout: '', stderr: '' }) };
    const result = await safeEdit.execute(params, ctx);
    if (!result.success) throw new Error(`Insert failed: ${result.results[0].error || 'unknown'}`);
    expect(result.results[0].diff).toContain('+ INSERTED');
  });

  it('should handle delete operation successfully', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'line1\ntodelete\nline2', 'utf8');
    const params = { operations: [{ file: 'sample.ts', editType: 'delete' as const, range: { start: 1, end: 2 }, newCode: undefined }], format: false, fixImports: false };
    const ctx = { cwd: tempDir, exec: async () => ({ code: 0, stdout: '', stderr: '' }) };
    const result = await safeEdit.execute(params, ctx);
    if (!result.success) throw new Error(`Delete failed: ${result.results[0].error || 'unknown'}`);
    expect(result.results[0].diff).toContain('- todelete');
    expect(result.results[0].diff).toContain('+ line2');
  });

  it('should return error for unknown editType', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'line1\nline2', 'utf8');
    // @ts-expect-error testing invalid editType
    const params = {
      operations: [{
        file: 'sample.ts',
        editType: 'move' as any, // invalid
        range: { start: 1, end: 1 },
        newCode: 'new'
      }]
    };
    const ctx = { cwd: tempDir };
    const result = await safeEdit.execute(params, ctx);
    expect(result.success).toBe(false);
    expect(result.results[0].error).toMatch(/Invalid editType|unknown editType/i);
  });
});
