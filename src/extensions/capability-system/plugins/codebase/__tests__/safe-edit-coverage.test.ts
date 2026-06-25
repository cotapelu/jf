import { describe, it, expect } from 'vitest';
import safeEdit from '../capabilities/safe_edit.ts';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

describe('safe_edit coverage gaps', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp('safe-edit-coverage-');
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return error when target file does not exist', async () => {
    const nonExistent = join(tempDir, 'nonexistent.ts');
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
});
