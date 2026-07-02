#!/usr/bin/env node
/**
 * Dev Format Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/format.js';

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

describe('dev.format capability', () => {

  describe('execute - success', () => {
    it('should format files with prettier', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'src/file1.ts 124ms\nsrc/file2.ts 98ms\n',
        stderr: ''
      });

      const result = await execute({ files: ['src/file1.ts', 'src/file2.ts'] }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['prettier', '--write', 'src/file1.ts', 'src/file2.ts']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.files).toEqual(['src/file1.ts', 'src/file2.ts']);
      expect(result.content[0].text).toContain('124ms');
    });

    it('should show success message when no output', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({ files: ['README.md'] }, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('✅ Formatted');
    });
  });

  describe('execute - validation', () => {
    it('should throw error if files array is empty', async () => {
      const mockCtx = createMockCtx('/test');

      const result = await execute({ files: [] }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('files array required');
    });
  });

  describe('execute - prettier failures', () => {
    it('should return error when prettier fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'error:Parsing error: Unexpected token (1:1)'
      });

      const result = await execute({ files: ['bad.ts'] }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Parsing error');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Formatted', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ files: ['file1.ts'] }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['prettier', '--write', 'file1.ts']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: 'Formatted', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({ files: ['file1.ts'] }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['prettier', '--write', 'file1.ts']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('prettier not installed'));

      const result = await execute({ files: ['file.ts'] }, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('prettier not installed');
    });
  });

});
