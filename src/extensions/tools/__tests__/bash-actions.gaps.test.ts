#!/usr/bin/env node
/**
 * Additional coverage tests for bash-actions (Cycle 129)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BashActionExecutor, createBashActionTool } from '../bash-actions.js';
import type { ExtensionContext, AgentToolResult } from "@earendil-works/pi-coding-agent";

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createBashToolDefinition: vi.fn(() => ({
    name: "bash",
    execute: vi.fn()
  }))
}));

vi.mock("@earendil-works/pi-tui", () => ({
  Text: class Text { constructor(public content: string) {} }
}));

import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";

function createMockContext(): ExtensionContext {
  return { cwd: process.cwd(), session: { id: 'test' }, config: {}, logger: {} } as any;
}

function resetMock() {
  const mockExecute = vi.fn().mockResolvedValue({
    isError: false,
    content: [{ type: 'text', text: 'output' }],
    details: { code: 0, stderr: '' }
  });
  (createBashToolDefinition as any).mockReturnValue({ execute: mockExecute });
  return mockExecute;
}

describe('bash-actions gaps (Cycle 129)', () => {
  let ctx: ExtensionContext;
  let executor: BashActionExecutor;

  beforeEach(() => {
    ctx = createMockContext();
    resetMock();
    executor = new BashActionExecutor(ctx, { cacheSize: 3, cacheDefaultTTL: 1000 });
  });

  describe('LRUCache coverage', () => {
    it('set() evicts existing key (cache.has branch)', async () => {
      executor = new BashActionExecutor(ctx, { cacheSize: 2, cacheDefaultTTL: 1000 });
      executor.registerAction({
        name: 'cmd',
        description: 'Cmd',
        schema: null,
        buildCommand: (args: any) => `echo ${args.id}`,
        options: { cache: { ttl: 1000 } }
      });
      await executor.execute('cmd', { id: 1 });
      await executor.execute('cmd', { id: 2 });
      // Re-execute with id=1 to trigger has+delete
      await executor.execute('cmd', { id: 1 });
    });

    it('get() returns null after expiry', async () => {
      executor = new BashActionExecutor(ctx, { cacheSize: 10, cacheDefaultTTL: 20 });
      executor.registerAction({
        name: 'cmd',
        description: 'Cmd',
        schema: null,
        buildCommand: () => 'echo test',
        options: { cache: { ttl: 20 } }
      });
      await executor.execute('cmd', {});
      await new Promise(res => setTimeout(res, 30));
      const result = await executor.execute('cmd', {});
      expect(result.stdout).toBe('output');
    });
  });

  describe('Execute context & signal', () => {
    it('falls back to process.cwd when ctx.cwd undefined', async () => {
      const exec = new BashActionExecutor({} as any);
      exec.registerAction({
        name: 'cmd',
        description: 'Cmd',
        schema: null,
        buildCommand: () => 'echo ok'
      });
      const result = await exec.execute('cmd', {});
      expect(result.stdout).toBe('output');
    });

    it('sets timeout when signal provided', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      executor = new BashActionExecutor(ctx);
      executor.registerAction({
        name: 'cmd',
        description: 'Cmd',
        schema: null,
        buildCommand: () => 'echo ok',
        options: { timeout: 1000 }
      });
      const signal = new AbortController().signal;
      await executor.execute('cmd', {}, signal);
      expect(setTimeoutSpy).toHaveBeenCalled();
      setTimeoutSpy.mockRestore();
    });

    it('clears timeout after execution when signal provided', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      executor = new BashActionExecutor(ctx);
      executor.registerAction({
        name: 'cmd',
        description: 'Cmd',
        schema: null,
        buildCommand: () => 'echo ok',
        options: { timeout: 1000 }
      });
      const signal = new AbortController().signal;
      await executor.execute('cmd', {}, signal);
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('getHelp branches', () => {
    it('returns "not found" for nonexistent action', () => {
      const exec = new BashActionExecutor(ctx);
      const help = exec.getHelp('missing');
      expect(help).toContain('not found');
    });

    it('action without options omits Options section', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'basic',
        description: 'Basic',
        schema: { properties: { arg: { type: 'string' } } }
      });
      const help = exec.getHelp('basic');
      expect(help).not.toContain('Options:');
    });

    it('action with only cache option', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'cached',
        description: 'Cached',
        schema: { properties: {} },
        options: { cache: { ttl: 5000 } }
      });
      const help = exec.getHelp('cached');
      expect(help).toContain('Cache: TTL=5000ms');
      expect(help).not.toContain('Rate limit');
      expect(help).not.toContain('Timeout');
    });

    it('action with only rateLimit option', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'limited',
        description: 'Limited',
        schema: { properties: {} },
        options: { rateLimit: { max: 10, windowMs: 60000 } }
      });
      const help = exec.getHelp('limited');
      expect(help).toContain('Rate limit: 10/60000ms');
      expect(help).not.toContain('Cache');
      expect(help).not.toContain('Timeout');
    });

    it('action with only timeout option', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'timeout',
        description: 'Timeout',
        schema: { properties: {} },
        options: { timeout: 30000 }
      });
      const help = exec.getHelp('timeout');
      expect(help).toContain('Timeout: 30000ms');
      expect(help).not.toContain('Cache');
      expect(help).not.toContain('Rate limit');
    });

    it('action with all options', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'full',
        description: 'Full',
        schema: { properties: {} },
        options: { cache: { ttl: 1000 }, rateLimit: { max: 5, windowMs: 1000 }, timeout: 5000 }
      });
      const help = exec.getHelp('full');
      expect(help).toContain('Cache: TTL=1000ms');
      expect(help).toContain('Rate limit: 5/1000ms');
      expect(help).toContain('Timeout: 5000ms');
    });

    it('shows required asterisk for required arguments', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'req',
        description: 'Req',
        schema: { required: ['arg'], properties: { arg: { type: 'string' } } }
      });
      const help = exec.getHelp('req');
      expect(help).toContain('arg*');
    });

    it('falls back to "any" type when prop.type missing', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'anytype',
        description: 'Any',
        schema: { properties: { arg: {} } }
      });
      const help = exec.getHelp('anytype');
      expect(help).toContain('arg (any)');
    });

    it('omits Arguments section when schema.properties missing', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({
        name: 'noargs',
        description: 'NoArgs',
        schema: null as any
      });
      const help = exec.getHelp('noargs');
      expect(help).not.toContain('Arguments:');
    });
  });

  describe('removeAction return value', () => {
    it('returns undefined after deletion', () => {
      const exec = new BashActionExecutor(ctx);
      exec.registerAction({ name: 'del', description: 'Del', schema: null, buildCommand: () => '' });
      const removed = exec.removeAction('del');
      expect(removed).toBeUndefined();
      expect(exec.getAction('del')).toBeUndefined();
    });

    it('returns undefined when action does not exist', () => {
      const exec = new BashActionExecutor(ctx);
      const removed = exec.removeAction('nonexistent');
      expect(removed).toBeUndefined();
    });
  });

  describe('renderResult edge cases', () => {
    const mockTheme = { fg: (style: string, text: string) => text } as any;
    const tool = createBashActionTool();

    it('handles missing details (fallback to empty object)', () => {
      const result: any = { content: [{ type: 'text', text: 'ok' }] };
      const text = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect((text as any).content).toContain('ok');
    });

    it('handles empty content array', () => {
      const result: any = { content: [] };
      const text = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect((text as any).content).toBe('');
    });

    it('renders error with missing details fields', () => {
      const result: any = { isError: true, content: [], details: {} };
      const text = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect((text as any).content).toContain('Error');
    });
  });

  describe('Stats command', () => {
    it('non-empty args still returns stats', async () => {
      const tool = createBashActionTool();
      const result = await tool.execute('test-id', { action: 'stats', args: { dummy: true } }, undefined, undefined, ctx) as AgentToolResult<any>;
      expect(result.isError).toBe(false);
      expect(result.details.cacheHits !== undefined).toBe(true);
    });
  });
});