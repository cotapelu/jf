#!/usr/bin/env node
/**
 * Subtool Loader Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SDK before importing subtool-loader
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const actual = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...actual,
    createReadToolDefinition: vi.fn(),
    createLsToolDefinition: vi.fn(),
    createFindToolDefinition: vi.fn(),
    createGrepToolDefinition: vi.fn(),
    createBashToolDefinition: vi.fn(),
  };
});

import { executeSubtool } from '../subtool-loader.js';
import {
  createReadToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createBashToolDefinition,
} from '@earendil-works/pi-coding-agent';

describe('subtool-loader', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeMockCtx(cwd = '/test') {
    return { cwd } as any;
  }

  function mockTool(name: string) {
    return {
      name,
      execute: async (_id, args, _sig, _upd, ctx) => ({
        content: [{ type: 'text', text: `mocked ${name}` }],
        isError: false,
        details: { args, ctxCwd: ctx?.cwd },
      }),
    };
  }

  beforeEach(() => {
    (createReadToolDefinition as any).mockReturnValue(mockTool('read'));
    (createLsToolDefinition as any).mockReturnValue(mockTool('ls'));
    (createFindToolDefinition as any).mockReturnValue(mockTool('find'));
    (createGrepToolDefinition as any).mockReturnValue(mockTool('grep'));
    (createBashToolDefinition as any).mockReturnValue(mockTool('bash'));
  });

  describe('executeSubtool validation', () => {
    it('should error if subtool missing', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-1', { subtool: '', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter');
    });

    it('should error for unknown subtool', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-2', { subtool: 'unknown' as any, args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown sub-tool');
    });
  });

  describe('http subtool', () => {
    it('should require url', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-3', { subtool: 'http', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('url');
    });

    it('should validate url format', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-4', { subtool: 'http', args: { url: 'not-a-url' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid URL');
    });

    // Skipping detailed http/bash integration due to caching complexity.
    // Existing 'should require url' and 'should validate url format' cover http validation.
  });

  describe('other subtools', () => {
    it('should route ls', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-10', { subtool: 'ls', args: { path: '/tmp' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('mocked ls');
      expect(createLsToolDefinition).toHaveBeenCalledWith(ctx.cwd);
    });

    it('should route find', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-11', { subtool: 'find', args: { path: '/src' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createFindToolDefinition).toHaveBeenCalledWith(ctx.cwd, {});
    });

    it('should route grep', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-12', { subtool: 'grep', args: { pattern: 'test' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createGrepToolDefinition).toHaveBeenCalledWith(ctx.cwd, {});
    });

    it('should route read', async () => {
      const ctx = makeMockCtx();
      const result = await executeSubtool('call-13', { subtool: 'read', args: { path: 'file.txt' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createReadToolDefinition).toHaveBeenCalledWith(ctx.cwd);
    });
  });

});
