#!/usr/bin/env node
/**
 * Computer Use Sub-Tools Tests
 *
 * Tests for file system operations (ls, find, grep, read).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeLs,
  executeFind,
  executeGrep,
  executeRead,
  lsSchema,
  findSchema,
  grepSchema,
  readSchema
} from './computer-use.js';

describe('Computer Use Sub-Tools', () => {
  const mockCtx = {
    exec: vi.fn()
  } as any;

  const defaultCwd = '/test/cwd';

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.exec = vi.fn();
  });

  describe('executeLs', () => {
    it('should list current directory with -l', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'file1\nfile2', stderr: '', code: 0, killed: false });
      const result = await executeLs({}, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-l'], { cwd: defaultCwd, signal: undefined });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('file1\nfile2');
    });

    it('should list specific path with -l', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'a\nb', stderr: '', code: 0, killed: false });
      await executeLs({ path: '/some/path' }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-l', '/some/path'], { cwd: '/some/path', signal: undefined });
    });

    it('should handle all flag with -la', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '.hidden', stderr: '', code: 0, killed: false });
      await executeLs({ all: true }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-la'], { cwd: defaultCwd, signal: undefined });
    });

    it('should handle recursive flag with -lR', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'dir:', stderr: '', code: 0, killed: false });
      await executeLs({ recursive: true }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-lR'], { cwd: defaultCwd, signal: undefined });
    });

    it('should handle error exit code', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: 'No such file', code: 1, killed: false });
      const result = await executeLs({ path: '/nonexistent' }, defaultCwd, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('No such file');
    });

    it('should handle thrown exception', async () => {
      mockCtx.exec.mockRejectedValue(new Error('ls command missing'));
      const result = await executeLs({}, defaultCwd, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ls error');
    });
  });

  describe('executeFind', () => {
    it('should find files with pattern', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: './a.js\n./b.js', stderr: '', code: 0, killed: false });
      await executeFind({ pattern: '*.js' }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('find', [defaultCwd, '-name', '*.js'], { cwd: defaultCwd, signal: undefined });
    });

    it('should use custom path', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0, killed: false });
      await executeFind({ pattern: '*.ts', path: '/src' }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('find', ['/src', '-name', '*.ts'], { cwd: defaultCwd, signal: undefined });
    });

    it('should include maxDepth', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0, killed: false });
      await executeFind({ pattern: '*.ts', maxDepth: 2 }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('find', [defaultCwd, '-maxdepth', '2', '-name', '*.ts'], { cwd: defaultCwd, signal: undefined });
    });

    it('should handle error', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: 'Permission denied', code: 1, killed: false });
      const result = await executeFind({ pattern: '*.ts' }, defaultCwd, undefined, mockCtx);
      expect(result.isError).toBe(true);
    });
  });

  describe('executeGrep', () => {
    it('should search with pattern recursively', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'file:match', stderr: '', code: 0, killed: false });
      await executeGrep({ pattern: 'foo' }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('grep', ['-r', 'foo'], { cwd: defaultCwd, signal: undefined });
    });

    it('should add -i flag when ignoreCase', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0, killed: false });
      await executeGrep({ pattern: 'foo', ignoreCase: true }, defaultCwd, undefined, mockCtx);
      const args = mockCtx.exec.mock.calls[0][1];
      expect(args).toContain('-i');
      expect(args).toContain('-r');
      expect(args).toContain('foo');
    });

    it('should add --include flag', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0, killed: false });
      await executeGrep({ pattern: 'bar', include: '*.ts' }, defaultCwd, undefined, mockCtx);
      const args = mockCtx.exec.mock.calls[0][1];
      expect(args).toContain('--include');
      expect(args).toContain('*.ts');
    });

    it('should add --exclude flag', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0, killed: false });
      await executeGrep({ pattern: 'baz', exclude: 'node_modules' }, defaultCwd, undefined, mockCtx);
      const args = mockCtx.exec.mock.calls[0][1];
      expect(args).toContain('--exclude');
      expect(args).toContain('node_modules');
    });

    it('should use custom path', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0, killed: false });
      await executeGrep({ pattern: 'test', path: '/src' }, defaultCwd, undefined, mockCtx);
      const opts = mockCtx.exec.mock.calls[0][2];
      expect(opts.cwd).toBe('/src');
    });
  });

  describe('executeRead', () => {
    it('should read entire file', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'full content', stderr: '', code: 0, killed: false });
      await executeRead({ path: 'file.txt' }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('bash', ["-c", "cat 'file.txt'"], { cwd: defaultCwd, signal: undefined });
    });

    it('should apply offset with tail', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'line3\nline4', stderr: '', code: 0, killed: false });
      await executeRead({ path: 'file.txt', offset: 3 }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('bash', ["-c", "cat 'file.txt' | tail -n +3"], expect.any(Object));
    });

    it('should apply limit with head', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'line1\nline2', stderr: '', code: 0, killed: false });
      await executeRead({ path: 'file.txt', limit: 2 }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('bash', ["-c", "cat 'file.txt' | head -n 2"], expect.any(Object));
    });

    it('should apply both offset and limit', async () => {
      mockCtx.exec.mockResolvedValue({ stdout: 'line3', stderr: '', code: 0, killed: false });
      await executeRead({ path: 'file.txt', offset: 3, limit: 1 }, defaultCwd, undefined, mockCtx);
      expect(mockCtx.exec).toHaveBeenCalledWith('bash', ["-c", "cat 'file.txt' | tail -n +3 | head -n 1"], expect.any(Object));
    });

    it('should handle read errors', async () => {
      mockCtx.exec.mockRejectedValue(new Error('file not found'));
      const result = await executeRead({ path: 'missing.txt' }, defaultCwd, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('read error');
    });
  });

  describe('Schemas', () => {
    it('should export all schema definitions', () => {
      expect(lsSchema).toBeDefined();
      expect(findSchema).toBeDefined();
      expect(grepSchema).toBeDefined();
      expect(readSchema).toBeDefined();
    });

    it('schemas should be TypeBox objects', () => {
      expect(typeof lsSchema).toBe('object');
      expect(typeof findSchema).toBe('object');
      expect(typeof grepSchema).toBe('object');
      expect(typeof readSchema).toBe('object');
    });
  });
});
