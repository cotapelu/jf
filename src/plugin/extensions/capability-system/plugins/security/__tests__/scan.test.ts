#!/usr/bin/env node
/**
 * Security Scan Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/scan.js';

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

describe('security.scan capability', () => {

  describe('execute - scan cwd (default)', () => {
    it('should scan current directory when no path provided', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Scanning...\nNo secrets detected',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['secret-scanner', '--path', '/test']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.path).toBe('/test');
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
      expect(result.content[0].text).toBe('Scan complete');
    });
  });

  describe('execute - specific path', () => {
    it('should scan specified path', async () => {
      const mockCtx = createMockCtx('/repo', {
        code: 0,
        stdout: 'Scanning /repo/src...\nClean',
        stderr: ''
      });

      const result = await execute({ path: '/repo/src' }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['secret-scanner', '--path', '/repo/src']),
        expect.objectContaining({ cwd: '/repo' })
      );
      expect(result.details.path).toBe('/repo/src');
    });

    it('should use relative path', async () => {
      const mockCtx = createMockCtx('/repo', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      await execute({ path: 'src' }, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['secret-scanner', '--path', 'src']),
        expect.any(Object)
      );
    });
  });

  describe('execute - scan failures', () => {
    it('should return error when secrets found', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'SECRET! API_KEY=sk-1234567890abcdef in file .env:1\nTotal: 1 secret(s) found'
      });

      const result = await execute({ path: '.' }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.details.path).toBe('.');
      expect(result.content[0].text).toContain('API_KEY');
    });

    it('should return error when scanner encounters error', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 2,
        stdout: '',
        stderr: 'error: cannot read directory \'/nonexistent\': no such file or directory'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(2);
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd for exec even when custom scan path provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Scanned', stderr: '' });
      const ctx = {
        cwd: '/execution/dir',
        exec: captureCwd as any,
      };

      await execute({ path: '/custom/scan/path' }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['secret-scanner', '--path', '/custom/scan/path']),
        expect.objectContaining({ cwd: '/execution/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Scanned', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['secret-scanner', '--path', expect.any(String)]),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('npx: command not found'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('npx: command not found');
    });
  });

});
