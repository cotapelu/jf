import { resolveSecurePath, resolveSecurePaths } from '../path-security.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PathSecurity', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'jf-test-'));
  });

  afterEach(async () => {
    try {
      await rm(cwd, { recursive: true, force: true });
    } catch (e) {}
  });

  it('resolves relative path within cwd', async () => {
    const filePath = 'sub/file.ts';
    const fullPath = resolveSecurePath(cwd, filePath);
    expect(fullPath).toBe(join(cwd, filePath));
  });

  it('throws when path resolves outside cwd', async () => {
    const outsidePath = '../outside/file.ts';
    expect(() => resolveSecurePath(cwd, outsidePath)).toThrow('Access denied');
  });

  it('throws when absolute path is outside cwd', async () => {
    const absoluteOutside = join(tmpdir(), 'outside.ts');
    expect(() => resolveSecurePath(cwd, absoluteOutside)).toThrow('Access denied');
  });

  it('allows absolute path inside cwd', async () => {
    const insidePath = join(cwd, 'file.ts');
    expect(() => resolveSecurePath(cwd, insidePath)).not.toThrow();
  });

  it('throws when path attempts to escape via parent directory', async () => {
    const dangerous = '../../etc/passwd';
    expect(() => resolveSecurePath(cwd, dangerous)).toThrow('Access denied');
  });

  it('resolveSecurePaths resolves an array of paths', async () => {
    const paths = ['a.ts', 'b.ts', 'c.ts'];
    const resolved = resolveSecurePaths(cwd, paths);
    expect(resolved).toHaveLength(3);
    resolved.forEach((p, i) => {
      expect(p).toBe(join(cwd, paths[i]));
    });
  });

  it('resolveSecurePaths throws on first invalid path', async () => {
    const paths = ['a.ts', '../escape.ts'];
    expect(() => resolveSecurePaths(cwd, paths)).toThrow('Access denied');
  });
});
