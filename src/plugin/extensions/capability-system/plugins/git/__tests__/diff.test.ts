#!/usr/bin/env node
/**
 * Git Diff Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/diff.ts';

function createMockCtx(cwd?: string, execResult?: any) {
  const mockExec = vi.fn();
  if (execResult !== undefined) {
    mockExec.mockResolvedValue(execResult);
  } else {
    mockExec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  }

  return {
    cwd: cwd || '/mock/repo',
    exec: mockExec as any,
  };
}

describe('git.diff capability', () => {

  describe('execute - default HEAD diff', () => {
    it('should diff against HEAD by default', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: `diff --git a/src/file1.ts b/src/file1.ts
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,3 @@
-function foo() { return 'old'; }
+function foo() { return 'new'; }
`,
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', 'HEAD', '--color=never']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.revision).toBe('HEAD');
      expect(result.content[0].text).toContain('diff --git');
    });

    it('should handle no changes output', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('(no changes)');
      expect(result.details.lines).toBe(1);
    });
  });

  describe('execute - custom revision', () => {
    it('should diff against specified revision', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'diff against main branch',
        stderr: ''
      });

      const result = await execute({ revision: 'main' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', 'main', '--color=never']),
        expect.any(Object)
      );
      expect(result.details.revision).toBe('main');
    });

    it('should diff between two commits (hash)', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'diff between abc123 and def456',
        stderr: ''
      });

      const result = await execute({ revision: 'abc123..def456' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', 'abc123..def456', '--color=never']),
        expect.any(Object)
      );
    });
  });

  describe('execute - git command failure', () => {
    it('should return error when git diff fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 128,
        stdout: '',
        stderr: 'fatal: ambiguous revision \'nonexistent\''
      });

      const result = await execute({ revision: 'nonexistent' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(128);
      expect(result.details.error).toContain('fatal: ambiguous revision');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'diff output', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ revision: 'HEAD' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', 'HEAD', '--color=never']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'diff output', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', 'HEAD', '--color=never']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('git not installed'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('git not installed');
    });
  });

});
