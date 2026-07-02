#!/usr/bin/env node
/**
 * Git Status Additional Edge Case Tests
 * Target: increase branch coverage for parser logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/status.js';

function createMockCtx(cwd?: string, execResult?: any) {
  const mockExec = vi.fn();
  if (execResult !== undefined) {
    mockExec.mockResolvedValue(execResult);
  } else {
    mockExec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  }
  return { cwd: cwd || '/mock/repo', exec: mockExec as any };
}

describe('git.status edge cases', () => {

  it('should handle empty output', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('(unknown)');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual([]);
  });

  it('should handle branch-only line (no file changes)', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '## main\n', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('main');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual([]);
  });

  it('should handle only untracked files (no branch line)', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '?? file1.ts\n?? file2.ts\n', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('(unknown)');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual(['file1.ts', 'file2.ts']);
  });

  it('should handle mixed staged (renamed and modified) and unstaged', async () => {
    const mockCtx = createMockCtx('/test', {
      code: 0,
      stdout: 'R  old.ts -> new.ts\nM  modified.ts\n M unstaged.ts\n',
      stderr: ''
    });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    // Parser: staged = entries where code != '??' and not starting with space (branch line already skipped)
    // 'R  old.ts -> new.ts' -> staged
    // 'M  modified.ts' -> staged
    // ' M unstaged.ts' (code starts with space) -> unstaged
    expect(result.details.staged).toHaveLength(2);
    expect(result.details.staged).toContain('R  old.ts -> new.ts');
    expect(result.details.staged).toContain('M  modified.ts');
    expect(result.details.unstaged).toEqual([' M unstaged.ts']);
    expect(result.details.untracked).toEqual([]);
  });

  describe('additional status codes', () => {
    it('should handle Added (A) files as staged', async () => {
      const mockCtx = createMockCtx('/test', { code: 0, stdout: 'A  newfile.ts\n', stderr: '' });
      const result = await execute({}, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details.staged).toContain('A  newfile.ts');
      expect(result.details.unstaged).toEqual([]);
    });

    it('should handle Deleted (D) files as staged', async () => {
      const mockCtx = createMockCtx('/test', { code: 0, stdout: 'D  deleted.ts\n', stderr: '' });
      const result = await execute({}, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details.staged).toContain('D  deleted.ts');
      expect(result.details.unstaged).toEqual([]);
    });

    it('should handle Copied (C) files as staged', async () => {
      const mockCtx = createMockCtx('/test', { code: 0, stdout: 'C  original.ts -> copy.ts\n', stderr: '' });
      const result = await execute({}, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details.staged).toContain('C  original.ts -> copy.ts');
    });

    it('should handle Type change (T) as staged', async () => {
      const mockCtx = createMockCtx('/test', { code: 0, stdout: 'T  mode-change.sh\n', stderr: '' });
      const result = await execute({}, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details.staged).toContain('T  mode-change.sh');
    });

    it('should handle Unmerged (U) as staged (conflict)', async () => {
      const mockCtx = createMockCtx('/test', { code: 0, stdout: 'U  conflict.ts\n', stderr: '' });
      const result = await execute({}, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details.staged).toContain('U  conflict.ts');
      expect(result.details.unstaged).toEqual([]);
    });

    it('should handle multiple different status codes together', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'A  added.ts\nM  modified.ts\nD  deleted.ts\nR  old -> new.ts\n?? untracked.ts\n',
        stderr: ''
      });
      const result = await execute({}, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details.staged).toHaveLength(4);
      expect(result.details.staged).toContain('A  added.ts');
      expect(result.details.staged).toContain('M  modified.ts');
      expect(result.details.staged).toContain('D  deleted.ts');
      expect(result.details.staged).toContain('R  old -> new.ts');
      expect(result.details.unstaged).toEqual([]);
      expect(result.details.untracked).toEqual(['untracked.ts']);
    });
  });

});
