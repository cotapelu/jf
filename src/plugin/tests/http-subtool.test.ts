#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHttp, httpSchema } from '../extensions/tools/sub-tools/http.js';

const mockExecResult = (stdout = '', stderr = '', code = 0) => ({ stdout, stderr, code });
function createMockCtx() { return { exec: vi.fn() }; }

describe('http sub-tool', () => {
  let ctx: any;
  beforeEach(() => { vi.clearAllMocks(); ctx = createMockCtx(); });

  it('httpSchema should be defined', () => {
    expect(httpSchema.type).toBe('object');
    expect(httpSchema.properties.url).toBeDefined();
  });

  it('should execute GET request', async () => {
    ctx.exec.mockResolvedValue(mockExecResult('ok'));
    await executeHttp({ url: 'https://test.com' }, '/cwd', undefined, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('curl', expect.arrayContaining(['--max-time', '30', 'https://test.com']), expect.anything());
  });

  it('should add method for POST', async () => {
    ctx.exec.mockResolvedValue(mockExecResult(''));
    await executeHttp({ url: 'https://test.com', method: 'POST' }, '/cwd', undefined, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('curl', expect.arrayContaining(['-X', 'POST']), expect.anything());
  });

  it('should add headers', async () => {
    ctx.exec.mockResolvedValue(mockExecResult(''));
    await executeHttp({ url: 'https://test.com', headers: { A: 'B' } }, '/cwd', undefined, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('curl', expect.arrayContaining(['-H', 'A: B']), expect.anything());
  });

  it('should write body to temp file for POST', async () => {
    ctx.exec.mockResolvedValue(mockExecResult(''));
    await executeHttp({ url: 'https://test.com', method: 'POST', body: { x: 1 } }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    const dataIndex = args.indexOf('--data');
    expect(dataIndex).toBeGreaterThan(-1);
    expect(args[dataIndex + 1]).toMatch(/^@\/tmp\/curl-data-/);
  });

  it('should add insecure flag', async () => {
    ctx.exec.mockResolvedValue(mockExecResult(''));
    await executeHttp({ url: 'https://test.com', insecure: true }, '/cwd', undefined, ctx);
    expect(ctx.exec.mock.calls[0][1]).toContain('-k');
  });

  it('should add user auth', async () => {
    ctx.exec.mockResolvedValue(mockExecResult(''));
    await executeHttp({ url: 'https://test.com', user: 'u:p' }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    expect(args).toContain('-u');
    expect(args).toContain('u:p');
  });

  it('should handle curl error', async () => {
    ctx.exec.mockResolvedValue(mockExecResult('', 'curl error', 1));
    const result = await executeHttp({ url: 'https://bad' }, '/cwd', undefined, ctx);
    expect(result.isError).toBe(true);
  });
});
