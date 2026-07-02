#!/usr/bin/env node
/**
 * Dev Scripts Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/scripts.js';

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

describe('dev.scripts capability', () => {

  describe('execute - list action', () => {
    it('should list available npm scripts', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Life cycle scripts:\n  test: vitest run\n  build: tsc\n  lint: eslint .\n',
        stderr: ''
      });

      const result = await execute({ action: 'list' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['run']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.action).toBe('list');
      expect(result.content[0].text).toContain('vitest run');
    });

    it('should show "No scripts" when stdout empty', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ action: 'list' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('No scripts');
    });
  });

  describe('execute - run action', () => {
    it('should run specified npm script', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '> evo@0.0.1 build\n> tsc\n',
        stderr: ''
      });

      const result = await execute({ action: 'run', script: 'build' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['run', 'build']),
        expect.any(Object)
      );
      expect(result.details.script).toBe('build');
      expect(result.details.action).toBe('run');
      expect(result.details.exitCode).toBe(0);
    });

    it('should show default message when no output', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ action: 'run', script: 'test' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Ran test');
    });
  });

  describe('execute - validation', () => {
    it('should throw error if action=run without script', async () => {
      const mockCtx = createMockCtx('/test');

      const result = await execute({ action: 'run' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe("script required when action='run'");
    });
  });

  describe('execute - failures', () => {
    it('should return error when npm run fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'npm ERR! code ENOENT\nnpm ERR! syscall open\nnpm ERR! path package.json\n'
      });

      const result = await execute({ action: 'run', script: 'build' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.action).toBe('run');
      expect(result.details.exitCode).toBe(1);
      expect(result.content[0].text).toContain('ENOENT');
    });

    it('should return error when list fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'npm ERR! missing script: start'
      });

      const result = await execute({ action: 'list' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.action).toBe('list');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd for list', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'scripts', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ action: 'list' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['run']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should use ctx.cwd for run', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'OK', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ action: 'run', script: 'test' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['run', 'test']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'OK', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({ action: 'run', script: 'build' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['run', 'build']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('npm not available'));

      const result = await execute({ action: 'list' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('npm not available');
    });
  });

});
