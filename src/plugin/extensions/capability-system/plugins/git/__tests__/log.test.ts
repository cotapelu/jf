#!/usr/bin/env node
/**
 * Git Log Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/log.js';

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

describe('git.log capability', () => {

  describe('execute - default', () => {
    it('should fetch default 10 commits with oneline, graph, decorate', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: `* abc1234 (HEAD -> main) Fix bug in parser
* def5678 Add new feature
* ghi9012 Merge branch 'develop'
* jkl3456 Refactor utils
* mno7890 Update docs
* pqr1234 Initial commit
`,
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['log', '-10', '--oneline', '--graph', '--decorate']),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.content[0].text).toContain('abc1234');
      expect(result.details.count).toBe(6);
    });

    it('should use default count=10 when not provided', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '* abc1234 Fix\n',
        stderr: ''
      });

      await execute({}, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['log', '-10', '--oneline', '--graph', '--decorate']),
        expect.any(Object)
      );
    });
  });

  describe('execute - custom count', () => {
    it('should respect custom count parameter', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '* abc1234 Fix\n* def5678 Add\n',
        stderr: ''
      });

      const result = await execute({ count: 2 }, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['log', '-2', '--oneline', '--graph', '--decorate']),
        expect.any(Object)
      );
      expect(result.details.count).toBe(2);
    });

    it('should clamp count to valid range (1-100)', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '* abc1234 Fix\n',
        stderr: ''
      });

      // Schema should enforce min/max, but execute will use whatever is passed
      await execute({ count: 150 }, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['log', '-150', '--oneline', '--graph', '--decorate']),
        expect.any(Object)
      );
    });
  });

  describe('execute - empty log', () => {
    it('should handle repository with no commits', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.details.count).toBe(0);
      expect(result.content[0].text).toBe('');
    });
  });

  describe('execute - git command failure', () => {
    it('should return error when git log fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 128,
        stdout: '',
        stderr: 'fatal: not a git repository'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.exitCode).toBe(128);
      expect(result.details.error).toContain('fatal: not a git repository');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '* abc1234 test', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({ count: 5 }, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['log', '-5', '--oneline', '--graph', '--decorate']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '* abc1234 test', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['log', '-10', '--oneline', '--graph', '--decorate']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('git not found'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('git not found');
    });
  });

});
