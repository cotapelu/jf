#!/usr/bin/env node
/**
 * Git Pull Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/pull.js';

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

describe('git.pull capability', () => {

  describe('execute - default origin pull', () => {
    it('should pull from origin by default', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Updating abc123..def456\nFast-forward\n',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['pull', 'origin']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.remote).toBe('origin');
      expect(result.details.branch).toBeUndefined();
    });

    it('should show success message when stdout empty', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('✅ Pulled from origin');
    });
  });

  describe('execute - specific branch', () => {
    it('should pull specific branch from remote', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Updating main...\n',
        stderr: ''
      });

      const result = await execute({ remote: 'upstream', branch: 'main' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['pull', 'upstream', 'main']),
        expect.any(Object)
      );
      expect(result.details.remote).toBe('upstream');
      expect(result.details.branch).toBe('main');
    });

    it('should use custom remote without branch', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ remote: 'myremote' }, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['pull', 'myremote']),
        expect.any(Object)
      );
      expect(result.details.remote).toBe('myremote');
    });
  });

  describe('execute - pull failures', () => {
    it('should return error when git pull fails (non-fast-forward)', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error: Your local changes to the following files would be overwritten by merge:'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.details.error).toContain('Your local changes');
    });

    it('should return error when remote branch not found', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 128,
        stdout: '',
        stderr: 'fatal: couldn\'t find remote ref "nonexistent"'
      });

      const result = await execute({ branch: 'nonexistent' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('fatal:');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Pulled', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ remote: 'origin' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['pull', 'origin']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Pulled', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['pull', 'origin']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('Network error'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('Network error');
    });
  });

});
