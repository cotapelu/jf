#!/usr/bin/env node
/**
 * Dev Build Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/build.js';

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

describe('dev.build capability', () => {

  describe('execute - success', () => {
    it('should run npm run build and return output', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '> evo@0.0.1 build\n> tsc\n',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['run', 'build']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.content[0].text).toContain('tsc');
      expect(result.details.exitCode).toBe(0);
    });

    it('should show default message when no output', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Build complete');
    });
  });

  describe('execute - build failure', () => {
    it('should return error when build fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error TS2307: Cannot find module \'./missing\'\n'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.content[0].text).toContain('TS2307');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Built', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['run', 'build']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Built', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

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
      mockCtx.exec.mockRejectedValue(new Error('npm not found'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('npm not found');
    });
  });

});
