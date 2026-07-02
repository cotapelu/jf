#!/usr/bin/env node
/**
 * System Metrics Capability Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/metrics.js';

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

describe('system.metrics capability', () => {

  describe('execute - success with JSON metrics', async () => {
    it('should retrieve and parse metrics JSON', async () => {
      const mockMetrics = {
        uptime: 12345,
        memory: { rss: 123456789, heapUsed: 98765432 },
        extensions: { loaded: 5, errors: 0 }
      };
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: JSON.stringify(mockMetrics),
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining(['-e', expect.stringContaining('require(\'@earendil-works/pi-coding-agent/metrics\')')]),
        expect.objectContaining({ cwd: '/test' })
      );
      expect(result.details).toEqual(mockMetrics);
      expect(result.content[0].text).toContain('"uptime": 12345');
    });

    it('should pretty-print JSON output', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: '{"key":"value"}',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('{\n  "key": "value"\n}');
    });
  });

  describe('execute - invalid JSON fallback', () => {
    it('should return raw stdout if JSON parse fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 0,
        stdout: 'Some non-JSON output with errors',
        stderr: ''
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.details).toEqual({ raw: 'Some non-JSON output with errors' });
      expect(result.content[0].text).toContain('Some non-JSON output');
    });
  });

  describe('execute - failures', () => {
    it('should return error when node command fails', async () => {
      const mockCtx = createMockCtx('/test', {
        code: 1,
        stdout: '',
        stderr: 'Error: Cannot find module'
      });

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details).toEqual({ raw: '' });
      expect(result.content[0].text).toContain('"raw": ""');
    });
  });

  describe('execute - cwd handling', () => {
    it('should use ctx.cwd when provided', async () => {
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '{"ok":true}', stderr: '' });
      const ctx = {
        cwd: '/custom/dir',
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining(['-e']),
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should fall back to process.cwd when ctx.cwd undefined', async () => {
      const processCwd = process.cwd();
      const captureCwd = vi.fn().mockResolvedValue({ code: 0, stdout: '{"ok":true}', stderr: '' });
      const ctx = {
        cwd: undefined,
        exec: captureCwd as any,
      };

      await execute({}, ctx);

      expect(captureCwd).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining(['-e']),
        expect.objectContaining({ cwd: processCwd })
      );
    });
  });

  describe('execute - exceptions', () => {
    it('should handle exec rejection', async () => {
      const mockCtx = createMockCtx('/test');
      mockCtx.exec.mockRejectedValue(new Error('node not installed'));

      const result = await execute({}, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('node not installed');
    });
  });

});
