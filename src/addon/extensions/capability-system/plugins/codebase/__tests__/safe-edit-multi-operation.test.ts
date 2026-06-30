import { describe, it, expect } from 'vitest';
import safeEdit from '../capabilities/safe_edit.ts';
import { join } from 'path';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';

describe('safe_edit multi-operation coverage', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp('safe-edit-multi-');
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should handle multiple operations on same file without re-backing up', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'line1\nline2\nline3', 'utf8');

    const params = {
      operations: [
        {
          file: 'sample.ts',
          editType: 'replace' as const,
          range: { start: 0, end: 1 },
          newCode: 'replaced1'
        },
        {
          file: 'sample.ts',
          editType: 'insert' as const,
          range: { start: 2, end: 2 },
          newCode: 'inserted'
        }
      ],
      format: false,
      fixImports: false
    };
    const ctx = {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => ({ code: 0, stdout: '', stderr: '' })
    };
    const result = await safeEdit.execute(params, ctx);
    expect(result.success).toBe(true);
    expect(result.results[0].success).toBe(true);

    const content = await readFile(file, 'utf8');
    expect(content).toBe('replaced1\nline2\ninserted\nline3');
  });
});
