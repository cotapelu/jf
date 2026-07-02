#!/usr/bin/env node
/**
 * Dev Test Capability Edge Case Tests
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
  return { cwd: cwd || '/mock/repo', exec: mockExec as any };
}

describe('dev.test edge cases', () => {

  it('should run plain npm test without args', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: 'Test Suites: 1 passed', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(mockCtx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test'], expect.any(Object));
  });

  it('should append files after --', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '', stderr: '' });
    await execute({ files: ['src/a.test.ts', 'src/b.test.ts'] }, mockCtx);
    expect(mockCtx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test -- "src/a.test.ts" "src/b.test.ts"'], expect.any(Object));
  });

  it('should add --watch flag', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: 'Watching...', stderr: '' });
    await execute({ watch: true }, mockCtx);
    expect(mockCtx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test -- --watch'], expect.any(Object));
  });

  it('should combine files and watch', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '', stderr: '' });
    await execute({ files: ['test.ts'], watch: true }, mockCtx);
    expect(mockCtx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test -- "test.ts" -- --watch'], expect.any(Object));
  });

  it('should propagate failure when tests fail', async () => {
    const mockCtx = createMockCtx('/test', { code: 1, stdout: 'FAIL', stderr: 'Test failed' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.details.exitCode).toBe(1);
  });

  it('should handle cwd correctly', async () => {
    const capture = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: '/custom', exec: capture as any };
    await execute({}, ctx);
    expect(capture).toHaveBeenCalledWith('bash', expect.arrayContaining(['-c', 'npm test']), expect.objectContaining({ cwd: '/custom' }));
  });

  it('should handle exec exception', async () => {
    const mockCtx = createMockCtx('/test');
    mockCtx.exec.mockRejectedValue(new Error('bash error'));
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.details.error).toBe('bash error');
  });

});
