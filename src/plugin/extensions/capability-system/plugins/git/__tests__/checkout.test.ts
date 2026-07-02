#!/usr/bin/env node
/**
 * Git Checkout Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/checkout.js';

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

describe('git.checkout capability', () => {

  describe('execute - existing branch', () => {
    it('should checkout existing branch without create flag', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Switched to branch \'develop\'\n',
        stderr: ''
      });

      const result = await execute({ branch: 'develop' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['checkout', 'develop']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.branch).toBe('develop');
      expect(result.details.created).toBe(false);
    });

    it('should use default message when stdout empty', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ branch: 'main' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Switched to main');
    });
  });

  describe('execute - create new branch', () => {
    it('should create and checkout new branch with -b flag', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Switched to a new branch \'feature-xyz\'\n',
        stderr: ''
      });

      const result = await execute({ branch: 'feature-xyz', create: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['checkout', '-b', 'feature-xyz']),
        expect.any(Object)
      );
      expect(result.details.created).toBe(true);
    });
  });

  describe('execute - errors', () => {
    it('should fail when branch does not exist', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error: pathspec \'nonexistent\' did not match any file(s) known to git'
      });

      const result = await execute({ branch: 'nonexistent' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.details.error).toContain('did not match any file(s) known to git');
    });

    it('should fail when uncommitted changes would be overwritten', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error: Your local changes to the following files would be overwritten by checkout:\n  modified:   src/file.ts\nPlease commit your changes or stash them before you switch branches.'
      });

      const result = await execute({ branch: 'main' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('local changes');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Switched', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ branch: 'test' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['checkout', 'test']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Switched', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({ branch: 'main' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['checkout', 'main']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('git not found'));

      const result = await execute({ branch: 'any' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('git not found');
    });
  });

});
