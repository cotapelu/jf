#!/usr/bin/env node
/**
 * Git Commit Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/commit.js';

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

describe('git.commit capability', () => {

  describe('execute - basic commit', () => {
    it('should commit staged changes with message', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '[main abc123] Fix bug\n 1 file changed, 1 insertion(+)',
        stderr: ''
      });

      const result = await execute({ message: 'Fix bug' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['commit', '-m', 'Fix bug']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.message).toBe('Fix bug');
      expect(result.details.all).toBeUndefined();
      expect(result.details.amend).toBeUndefined();
    });

    it('should show default message when stdout empty', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ message: 'Initial' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('✅ Committed');
    });
  });

  describe('execute - commit -a (all staged)', () => {
    it('should commit all changes with -a flag', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Wrote tree...',
        stderr: ''
      });

      const result = await execute({ message: 'Update all', all: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['commit', '-a', '-m', 'Update all']),
        expect.any(Object)
      );
      expect(result.details.all).toBe(true);
    });
  });

  describe('execute - commit --amend', () => {
    it('should amend previous commit', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '[main def456] Updated message\n',
        stderr: ''
      });

      const result = await execute({ message: 'Updated message', amend: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['commit', '--amend', '-m', 'Updated message']),
        expect.any(Object)
      );
      expect(result.details.amend).toBe(true);
    });

    it('should combine -a and --amend', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ message: 'Fix with all', all: true, amend: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['commit', '-a', '--amend', '-m', 'Fix with all']),
        expect.any(Object)
      );
    });
  });

  describe('execute - commit failures', () => {
    it('should return error when nothing to commit', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'On branch main\nnothing to commit, working tree clean'
      });

      const result = await execute({ message: 'Oops' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.details.error).toContain('nothing to commit');
    });

    it('should return error when pre-commit hook fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error: pre-commit hook failed\nhook declined to commit'
      });

      const result = await execute({ message: 'Test' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('pre-commit hook failed');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Committed', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ message: 'Test' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['commit', '-m', 'Test']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Committed', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({ message: 'Test' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['commit', '-m', 'Test']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('git config error'));

      const result = await execute({ message: 'Test' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('git config error');
    });
  });

});
