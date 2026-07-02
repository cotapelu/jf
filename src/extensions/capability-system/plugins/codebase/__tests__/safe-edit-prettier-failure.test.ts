import { describe, it, expect } from 'vitest';
import safeEdit from '../capabilities/safe_edit.ts';
import { join } from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';

describe('safe_edit prettier failure coverage', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp('safe-edit-prettier-');
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should fail when prettier returns non-zero exit code', async () => {
    const file = join(tempDir, 'sample.ts');
    await writeFile(file, 'line1\nline2', 'utf8');

    const params = {
      operations: [{
        file: 'sample.ts',
        editType: 'insert' as const,
        range: { start: 1, end: 1 },
        newCode: 'INSERTED'
      }],
      format: true,    // enable formatting to trigger prettier
      fixImports: false // avoid eslint
    };

    const ctx = {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => {
        if (cmd === 'npx' && args[0] === 'tsc') {
          return { code: 0, stdout: '', stderr: '' };
        }
        if (cmd === 'npx' && args[0] === 'prettier') {
          return { code: 1, stdout: '', stderr: 'Prettier error' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }
    };

    const result = await safeEdit.execute(params, ctx);
    expect(result.success).toBe(false);
    expect(result.results[0].error).toMatch(/Prettier formatting failed|exit 1/i);
    expect(result.results[0].backupRestored).toBe(true);
  });
});
