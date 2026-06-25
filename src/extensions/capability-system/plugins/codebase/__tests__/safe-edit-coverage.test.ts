import { describe, it, expect } from 'vitest';
import safeEdit from '../capabilities/safe_edit.ts';
import { join } from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';

describe('safe_edit coverage gaps', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp('safe-edit-coverage-');
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return error when target file does not exist', async () => {
    const params = {
      operations: [{
        file: 'nonexistent.ts',
        editType: 'replace' as const,
        range: { start: 0, end: 1 },
        newCode: 'new content'
      }]
    };
    const ctx = { cwd: tempDir };
    const result = await safeEdit.execute(params, ctx);
    expect(result.success).toBe(false);
    expect(result.results[0].error).toMatch(/File not found|ENOENT|no such file/);
  });

  it('should return error for invalid operation (missing newCode)', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'line1\nline2', 'utf8');
    const params = {
      operations: [{
        file: 'sample.ts',
        editType: 'replace' as const,
        range: { start: 0, end: 1 }
        // newCode missing
      }]
    };
    const ctx = { cwd: tempDir };
    const result = await safeEdit.execute(params, ctx);
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain('newCode is required');
  });

  it('should return error for invalid range (out of bounds)', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'line1\nline2', 'utf8');
    const params = {
      operations: [{
        file: 'sample.ts',
        editType: 'replace' as const,
        range: { start: 0, end: 5 },
        newCode: 'new content'
      }]
    };
    const ctx = { cwd: tempDir };
    const result = await safeEdit.execute(params, ctx);
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain('Invalid range');
  });
});
