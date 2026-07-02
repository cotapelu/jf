#!/usr/bin/env node
/**
 * Dev Audit Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/audit.js';

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

describe('dev.audit capability', () => {

  describe('execute - audit check', () => {
    it('should run npm audit by default', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'found 0 vulnerabilities',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['audit']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.fix).toBeUndefined();
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
      expect(result.content[0].text).toBe('Audit complete');
    });
  });

  describe('execute - audit fix', () => {
    it('should run npm audit -- fix when fix=true', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'fixed 2 vulnerabilities',
        stderr: ''
      });

      const result = await execute({ fix: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['audit', '--', 'fix']),
        expect.any(Object)
      );
      expect(result.details.fix).toBe(true);
    });
  });

  describe('execute - audit failures', () => {
    it('should return error when vulnerabilities found', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: ' Low | Regular expression denial of service in host validation\n  Package: hosted-git-info\n  Patched in: >=2.7.9'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.details.fix).toBeUndefined();
      expect(result.content[0].text).toContain('Regular expression denial');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'OK', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['audit']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'OK', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['audit']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('network error'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('network error');
    });
  });

});
