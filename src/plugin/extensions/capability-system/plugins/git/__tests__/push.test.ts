#!/usr/bin/env node
/**
 * Git Push Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/push.js';

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

describe('git.push capability', () => {

  describe('execute - default push', () => {
    it('should push to origin current branch by default', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Enumerating objects: 5, done.\nCounting objects: 100% (5/5), done.\n',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['push', 'origin']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.remote).toBe('origin');
      expect(result.details.branch).toBeUndefined();
      expect(result.details.setUpstream).toBeUndefined();
    });

    it('should show success message when stdout empty', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('✅ Pushed to origin');
    });
  });

  describe('execute - specific branch and remote', () => {
    it('should push specific branch to custom remote', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Total 0 (delta 0), reused 0 (delta 0)',
        stderr: ''
      });

      const result = await execute({ remote: 'upstream', branch: 'main' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['push', 'upstream', 'main']),
        expect.any(Object)
      );
      expect(result.details.remote).toBe('upstream');
      expect(result.details.branch).toBe('main');
    });

    it('should push with -u flag to set upstream', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Branch main set up to track remote branch main from upstream.',
        stderr: ''
      });

      const result = await execute({ remote: 'upstream', branch: 'main', setUpstream: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['push', '-u', 'upstream', 'main']),
        expect.any(Object)
      );
      expect(result.details.setUpstream).toBe(true);
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
        expect.arrayContaining(['push', 'myremote']),
        expect.any(Object)
      );
      expect(result.details.remote).toBe('myremote');
    });
  });

  describe('execute - push failures', () => {
    it('should return error when git push fails (non-fast-forward)', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error: failed to push some refs to \'https://github.com/user/repo.git\'\nhint: Updates were rejected because the tip of your current branch is behind'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.details.error).toContain('Updates were rejected');
    });

    it('should return error when remote rejected', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 128,
        stdout: '',
        stderr: 'remote: Resolving deltas: 100% (5/5), completed.\nremote: error: GH001: Large files detected. You may want to try Git Large File Storage.'
      });

      const result = await execute({ branch: 'main' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('GH001');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Pushed', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ remote: 'origin' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['push', 'origin']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Pushed', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['push', 'origin']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('Network unreachable'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('Network unreachable');
    });
  });

});
