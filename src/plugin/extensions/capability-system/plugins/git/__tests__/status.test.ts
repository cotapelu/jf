#!/usr/bin/env node
/**
 * Git Status Capability Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from '../capabilities/status.js';

// Mock context
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

describe('git.status capability', () => {

  describe('execute - happy path', () => {
    it('should parse porcelain output with branch and staged/unstaged/untracked files', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: `
## main...origin/main
M  src/file1.ts
A  src/file2.ts
?? newfile.ts
 M src/file3.ts
`,
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.details.branch).toBe('main');
      expect(result.details.staged).toContain('M  src/file1.ts');
      expect(result.details.staged).toContain('A  src/file2.ts');
      expect(result.details.unstaged).toContain(' M src/file3.ts');
      expect(result.details.untracked).toContain('newfile.ts');
      expect(result.details.totalFiles).toBe(4);
    });

    it('should handle empty status (no changes)', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '## main\n',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.details.branch).toBe('main');
      expect(result.details.staged).toEqual([]);
      expect(result.details.unstaged).toEqual([]);
      expect(result.details.untracked).toEqual([]);
      expect(result.details.totalFiles).toBe(0);
    });

    it('should handle unknown branch when no upstream', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '## HEAD (no branch)\n',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.details.branch).toBe('HEAD (no branch)');
    });

    it('should default to (unknown) branch when no branch line', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'M  file1.ts\n',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.details.branch).toBe('(unknown)');
    });

    it('should correctly categorize file status codes', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: `
## main
A  added.txt
M  modified.txt
D  deleted.txt
R  renamed.txt
C  copied.txt
?? untracked.txt
UU unmerged.txt
`,
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.details.staged).toContain('A  added.txt');
      expect(result.details.staged).toContain('M  modified.txt');
      expect(result.details.unstaged).toEqual([]); // space-modified
      expect(result.details.untracked).toContain('untracked.txt');
    });
  });

  describe('execute - git command failure', () => {
    it('should return error when git status fails (non-zero exit code)', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'fatal: not a git repository'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('fatal: not a git repository');
      expect(result.details.exitCode).toBe(1);
    });

    it('should handle stderr output on failure', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 128,
        stdout: '',
        stderr: 'error: could not lock config file'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ git status failed');
    });
  });

  describe('execute - exceptions', () => {
    it('should handle thrown exception from exec', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('ENOENT: git not found'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('ENOENT: git not found');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when available', async () => {
      const mockCtx = createMockCtx('/custom/path', {
        code: 0,
        stdout: '## main\n',
        stderr: ''
      });
      // Re-create mock to capture cwd
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '## main\n', stderr: '' });
      const ctxWithCapture = {
        cwd: '/custom/path',
        exec: captureCwd as any,
      };

      await execute({}, ctxWithCapture);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['status', '--porcelain', '--branch']),
        expect.objectContaining({ cwd: '/custom/path' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd is undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '## main\n', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['status', '--porcelain', '--branch']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });
});
