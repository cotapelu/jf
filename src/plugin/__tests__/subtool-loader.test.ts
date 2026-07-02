#!/usr/bin/env node
/**
 * SubTool Loader Tests
 *
 * Covers validation, routing, error handling, and caching.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock pi-coding-agent
vi.mock('@earendil-works/pi-coding-agent', () => ({
  createReadToolDefinition: vi.fn(),
  createLsToolDefinition: vi.fn(),
  createFindToolDefinition: vi.fn(),
  createGrepToolDefinition: vi.fn(),
  createBashToolDefinition: vi.fn(),
}));

import { createSubLoaderToolDefinition } from '../extensions/tools/subtool-loader.js';
import {
  createReadToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createBashToolDefinition,
} from '@earendil-works/pi-coding-agent';

function createMockContext(cwd = '/repo') {
  return { cwd };
}

describe('SubTool Loader', () => {
  let tool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful tool
    const mockExecute = vi.fn().mockResolvedValue({
      isError: false,
      content: [{ type: 'text', text: 'ok' }],
    });
    const mockTool = { execute: mockExecute };
    createReadToolDefinition.mockReturnValue(mockTool);
    createLsToolDefinition.mockReturnValue(mockTool);
    createFindToolDefinition.mockReturnValue(mockTool);
    createGrepToolDefinition.mockReturnValue(mockTool);
    createBashToolDefinition.mockReturnValue(mockTool);

    tool = createSubLoaderToolDefinition();
  });

  describe('Tool definition', () => {
    it('has correct metadata', () => {
      expect(tool.name).toBe('plugin.subtool_loader');
      expect(tool.label).toBe('SubTool Loader');
      expect(tool.description).toContain('SDK tools');
      expect(tool.promptSnippet).toContain('subtool_loader');
    });

    it('has TypeBox schema with required subtool and args', () => {
      const params = (tool as any).parameters;
      expect(params.type).toBe('object');
      expect(params.properties.subtool).toBeDefined();
      expect(params.properties.args).toBeDefined();
      expect(params.required).toContain('subtool');
      expect(params.required).toContain('args');
      expect(params.properties.subtool.enum).toEqual(['http', 'ls', 'find', 'grep', 'read']);
    });

    it('includes prompt guidelines for all sub-tools', () => {
      const guidelines = (tool as any).promptGuidelines as string[];
      const g = guidelines.join('\n').toLowerCase();
      expect(g).toMatch(/read/);
      expect(g).toMatch(/ls/);
      expect(g).toMatch(/find/);
      expect(g).toMatch(/grep/);
      expect(g).toMatch(/http/);
    });
  });

  describe('execute validation', () => {
    it('returns error when subtool missing', async () => {
      const ctx = createMockContext();
      // @ts-ignore
      const result = await tool.execute('call-1', { args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: subtool');
    });

    it('returns error for unknown subtool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'invalid', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown sub-tool: invalid');
    });

    it('routes http with missing URL', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'http', args: { method: 'POST' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: url');
    });

    it('routes http with invalid URL', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'http', args: { url: 'not-a-url' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid URL: not-a-url');
    });

    it('routes http success with all params', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', {
        subtool: 'http',
        args: { url: 'https://example.com', method: 'POST', headers: { 'X-Test': 'value' }, body: 'test' },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      // createHttpTool wraps createBashToolDefinition; it should be called
      expect(createBashToolDefinition).toHaveBeenCalledWith(ctx.cwd, { commandPrefix: '' });
      expect(result.details.url).toBe('https://example.com');
      expect(result.details.method).toBe('POST');
      expect(result.details.headers).toEqual({ 'X-Test': 'value' });
    });

    it('routes http success with minimal params', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'http', args: { url: 'https://example.com' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.method).toBe('GET');
    });

    it('routes ls to SDK tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'ls', args: { all: true } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      // createLsToolWrapper calls createLsToolDefinition with cwd only
      expect(createLsToolDefinition).toHaveBeenCalledWith(ctx.cwd);
    });

    it('routes find to SDK tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'find', args: { pattern: '*.ts' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      // createFindToolWrapper calls with (cwd, {})
      expect(createFindToolDefinition).toHaveBeenCalledWith(ctx.cwd, {});
    });

    it('routes grep to SDK tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'grep', args: { pattern: 'test' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      // createGrepToolWrapper calls with (cwd, {})
      expect(createGrepToolDefinition).toHaveBeenCalledWith(ctx.cwd, {});
    });

    it('routes read to SDK tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { subtool: 'read', args: { path: '/file.txt' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createReadToolDefinition).toHaveBeenCalledWith(ctx.cwd);
    });

    it('forwards SDK errors from non-HTTP tools', async () => {
      const ctx = createMockContext();
      const errorExecute = vi.fn().mockResolvedValue({ isError: true, content: [{ type: 'text', text: 'SDK error' }] });
      const errorTool = { execute: errorExecute };
      createLsToolDefinition.mockReturnValue(errorTool);
      const result = await tool.execute('call-2', { subtool: 'ls', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('SDK error');
    });

    it('handles thrown exceptions from SDK', async () => {
      const ctx = createMockContext();
      const throwingExecute = vi.fn().mockRejectedValue(new Error('Network failure'));
      const throwingTool = { execute: throwingExecute };
      createBashToolDefinition.mockReturnValue(throwingTool);
      const result = await tool.execute('call-3', { subtool: 'http', args: { url: 'https://example.com' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error: Network failure');
      expect(result.details?.error).toBe('Network failure');
    });
  });

  describe('caching behavior', () => {
    it('caches tools per context', async () => {
      // Create two distinct context objects
      const ctx1 = createMockContext('/cwd1');
      const ctx2 = createMockContext('/cwd2');

      // Reset mock call counts
      createLsToolDefinition.mockClear();

      // First call with ctx1 should call factory once
      await tool.execute('call-1', { subtool: 'ls', args: {} }, undefined, undefined, ctx1);
      const callsAfterFirst = createLsToolDefinition.mock.calls.length;

      // Second call with same ctx1 should use cache, not call factory again
      await tool.execute('call-2', { subtool: 'ls', args: {} }, undefined, undefined, ctx1);
      expect(createLsToolDefinition).toHaveBeenCalledTimes(callsAfterFirst);

      // Call with different ctx2 should call factory again
      await tool.execute('call-3', { subtool: 'ls', args: {} }, undefined, undefined, ctx2);
      expect(createLsToolDefinition).toHaveBeenCalledTimes(callsAfterFirst + 1);
    }, 10000);
  });
});
