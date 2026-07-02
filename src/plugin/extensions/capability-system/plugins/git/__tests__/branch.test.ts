#!/usr/bin/env node
/**
 * Git Branch Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/branch.js';

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

describe('git.branch capability', () => {

  describe('execute - list action', () => {
    it('should list all branches with -a flag', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: `  main
  develop
* feature/test
  remotes/origin/HEAD -> origin/main
  remotes/origin/develop
  remotes/origin/feature/test
`,
        stderr: ''
      });

      const result = await execute({ action: 'list' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.details.action).toBe('list');
      expect(result.content[0].text).toContain('main');
      expect(result.content[0].text).toContain('* feature/test');
    });

    it('should handle empty branch list', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ action: 'list' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text.trim()).toBe('');
    });
  });

  describe('execute - create action', () => {
    it('should create a new branch', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ action: 'create', name: 'feature/new' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['branch', 'feature/new']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.branch).toBe('feature/new');
    });

    it('should throw error if name missing for create', async () => {
      const mockCtx = createMockCtx('/test');

      const result = await execute({ action: 'create' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('name required for create');
    });
  });

  describe('execute - delete action', () => {
    it('should delete a branch with -d flag', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ action: 'delete', name: 'feature/old' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['branch', '-d', 'feature/old']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.branch).toBe('feature/old');
    });

    it('should throw error if name missing for delete', async () => {
      const mockCtx = createMockCtx('/test');

      const result = await execute({ action: 'delete' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('name required for delete');
    });

    it('should handle delete failure (branch not merged)', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error: The branch \'feature/unmerged\' is not fully merged.'
      });

      const result = await execute({ action: 'delete', name: 'feature/unmerged' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'main', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ action: 'list' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['branch', '-a']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'main', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({ action: 'list' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['branch', '-a']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('git not installed'));

      const result = await execute({ action: 'list' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('git not installed');
    });
  });

});
