#!/usr/bin/env node
/**
 * Git Add Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/add.js';

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

describe('git.add capability', () => {

  describe('execute - staging files', () => {
    it('should stage specific files', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ files: ['src/file1.ts', 'src/file2.ts'] }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['add', 'src/file1.ts', 'src/file2.ts']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.content[0].text).toContain('✅ Staged src/file1.ts, src/file2.ts');
      expect(result.details.files).toEqual(['src/file1.ts', 'src/file2.ts']);
      expect(result.details.all).toBeUndefined();
    });

    it('should stage single file', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ files: ['README.md'] }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['add', 'README.md']),
        expect.any(Object)
      );
      expect(result.content[0].text).toContain('✅ Staged README.md');
    });

    it('should stage all changes with -A flag', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ all: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['add', '-A']),
        expect.any(Object)
      );
      expect(result.content[0].text).toContain('✅ Staged all changes');
      expect(result.details.all).toBe(true);
    });
  });

  describe('execute - validation errors', () => {
    it('should throw error if neither files nor all provided', async () => {
      const mockCtx = createMockCtx('/test');

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain("Must specify either 'files' array or 'all: true'");
    });

    it('should throw error if files array is empty', async () => {
      const mockCtx = createMockCtx('/test');

      const result = await execute({ files: [] }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain("Must specify either 'files' array or 'all: true'");
    });
  });

  describe('execute - git command failure', () => {
    it('should return error when git add fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'fatal: pathspec \'nonexistent.ts\' did not match any files'
      });

      const result = await execute({ files: ['nonexistent.ts'] }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.content[0].text).toContain('❌ git add failed');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ files: ['file1.ts'] }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['add', 'file1.ts']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({ all: true }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['add', '-A']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('git command not found'));

      const result = await execute({ files: ['file.ts'] }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('git command not found');
    });
  });

});
