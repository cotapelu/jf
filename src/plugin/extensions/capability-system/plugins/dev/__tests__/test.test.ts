#!/usr/bin/env node
/**
 * Dev Test Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/test.js';

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

describe('dev.test capability', () => {

  describe('execute - default', () => {
    it('should run npm test with no args', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Test Suites: 5 passed, 0 failed\n',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'bash',
        expect.arrayContaining(['-c', 'npm test']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details.files).toBeUndefined();
      expect(result.details.watch).toBeUndefined();
      expect(result.details.exitCode).toBe(0);
    });

    it('should handle no output gracefully', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('No output');
    });
  });

  describe('execute - with files', () => {
    it('should run npm test with specific file paths', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '√ src/file1.test.ts\n√ src/file2.test.ts\n',
        stderr: ''
      });

      const result = await execute({ files: ['src/file1.test.ts', 'src/file2.test.ts'] }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'bash',
        expect.arrayContaining(['-c', 'npm test -- "src/file1.test.ts" "src/file2.test.ts"']),
        expect.any(Object)
      );
      expect(result.details.files).toEqual(['src/file1.test.ts', 'src/file2.test.ts']);
      expect(result.details.watch).toBeUndefined();
    });

    it('should quote file paths with spaces', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      await execute({ files: ['src/file with space.test.ts'] }, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith(
        'bash',
        expect.arrayContaining(['-c', 'npm test -- "src/file with space.test.ts"']),
        expect.any(Object)
      );
    });
  });

  describe('execute - watch mode', () => {
    it('should add --watch flag', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Watching...',
        stderr: ''
      });

      const result = await execute({ watch: true }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'bash',
        expect.arrayContaining(['-c', 'npm test -- --watch']),
        expect.any(Object)
      );
      expect(result.details.watch).toBe(true);
    });

    it('should combine files and watch', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      await execute({ files: ['test1.ts'], watch: true }, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith(
        'bash',
        expect.arrayContaining(['-c', 'npm test -- "test1.ts" -- --watch']),
        expect.any(Object)
      );
    });
  });

  describe('execute - test failures', () => {
    it('should return isError when tests fail', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'FAIL  src/bad.test.ts\n  × Expected 1 to equal 2'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(1);
      expect(result.content[0].text).toContain('Expected 1 to equal 2');
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
        'bash',
        expect.arrayContaining(['-c', 'npm test']),
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
        'bash',
        expect.arrayContaining(['-c', 'npm test']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('bash: npm: command not found'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('bash: npm: command not found');
    });
  });

});
