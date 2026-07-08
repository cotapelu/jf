#!/usr/bin/env node

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

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
import * as BashActions from "../bash-actions";

function createMockContext(): ExtensionContext {
  return { cwd: process.cwd(), session: { id: 'test' }, config: {}, logger: {} } as any;
}

describe('BashActionExecutor', () => {
  let executor: any;
  let ctx: ExtensionContext;

  function resetMock() {
    const mockExecute = vi.fn().mockResolvedValue({
      isError: false, content: [{ type: 'text', text: 'output' }], details: { code: 0, stderr: '' }
    });
    (createBashToolDefinition as any).mockReturnValue({ execute: mockExecute });
    return mockExecute;
  }

  beforeEach(() => {
    ctx = createMockContext();
    resetMock();
    executor = new BashActions.BashActionExecutor(ctx, { cacheSize: 10, cacheDefaultTTL: 1000 });
  });

  describe('Registration', () => {
    it('registers and retrieves action', () => {
      const action = { name: 'test', description: 'Test', schema: null, buildCommand: () => 'cmd' };
      executor.registerAction(action);
      expect(executor.getAction('test')).toBe(action);
    });

    it('lists actions', () => {
      executor.registerAction({ name: 'a', description: 'A', schema: null, buildCommand: () => '' });
      executor.registerAction({ name: 'b', description: 'B', schema: null, buildCommand: () => '' });
      expect(executor.listActions().map((a: any) => a.name).sort()).toEqual(['a', 'b']);
    });

    it('throws on duplicate', () => {
      const a = { name: 'dup', description: 'D', schema: null, buildCommand: () => '' };
      executor.registerAction(a);
      expect(() => executor.registerAction(a)).toThrow('already registered');
    });

    it('removes action', () => {
      executor.registerAction({ name: 'x', description: 'X', schema: null, buildCommand: () => '' });
      expect(executor.getAction('x')).toBeDefined();
      executor.removeAction('x');
      expect(executor.getAction('x')).toBeUndefined();
    });
  });

  describe('Execute', () => {
    it('executes shell command', async () => {
      executor.registerAction({
        name: 'shell',
        description: 'Shell',
        schema: null,
        buildCommand: (args: any) => args.command
      });
      const result = await executor.execute('shell', { command: 'ls' });
      expect(result.stdout).toBe('output');
      expect(result.code).toBe(0);
    });

    it('executes glob', async () => {
      executor.registerAction({
        name: 'glob',
        description: 'Glob',
        schema: null,
        buildCommand: (args: any) => `find . -name "${args.pattern}"`
      });
      const result = await executor.execute('glob', { pattern: '**/*.ts' });
      expect(result.stdout).toBe('output');
    });
  });

  describe('Caching', () => {
    it('caches identical calls', async () => {
      const mockExec = resetMock();
      executor = new BashActions.BashActionExecutor(ctx);

      executor.registerAction({
        name: 'cached',
        description: 'Cached',
        schema: null,
        buildCommand: () => 'cmd',
        options: { cache: { ttl: 5000 } }
      });

      await executor.execute('cached', {});
      const r2 = await executor.execute('cached', {});
      expect(r2.cached).toBe(true);
      expect(mockExec).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limiting', () => {
    it('enforces limit', async () => {
      resetMock();
      executor = new BashActions.BashActionExecutor(ctx);

      executor.registerAction({
        name: 'limited',
        description: 'Limited',
        schema: null,
        buildCommand: () => 'cmd',
        options: { cache: { ttl: 0 }, rateLimit: { max: 1, windowMs: 60000 } }
      });

      await executor.execute('limited', {}); // OK
      await expect(executor.execute('limited', {})).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Metrics', () => {
    it('counts executions', async () => {
      resetMock();
      executor = new BashActions.BashActionExecutor(ctx);

      executor.registerAction({ name: 'cnt', description: 'Cnt', schema: null, buildCommand: () => 'echo ok' });
      await executor.execute('cnt', {});
      await executor.execute('cnt', {});

      const stats = executor.getStats();
      expect((stats.metrics as any)['cnt'].count).toBe(2);
    });
  });

  describe('Validation', () => {
    it('requires fields', async () => {
      resetMock();
      executor = new BashActions.BashActionExecutor(ctx);

      executor.registerAction({
        name: 'val',
        description: 'Val',
        schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
        buildCommand: () => ''
      });

      await expect(executor.execute('val', {})).rejects.toThrow('Validation failed');
    });

    it('checks types', async () => {
      resetMock();
      executor = new BashActions.BashActionExecutor(ctx);

      executor.registerAction({
        name: 'type',
        description: 'Type',
        schema: { type: 'object', properties: { n: { type: 'number' } } },
        buildCommand: () => ''
      });

      await expect(executor.execute('type', { n: 'str' })).rejects.toThrow('Must be number');
    });

    it('validates enums', async () => {
      resetMock();
      executor = new BashActions.BashActionExecutor(ctx);

      executor.registerAction({
        name: 'enum',
        description: 'Enum',
        schema: { type: 'object', properties: { m: { type: 'string', enum: ['a', 'b'] } } },
        buildCommand: () => ''
      });

      await expect(executor.execute('enum', { m: 'c' })).rejects.toThrow('Must be one of');
    });
  });

  describe('Help & Stats', () => {
    it('gets action help', () => {
      executor.registerAction({
        name: 'help_test',
        description: 'HelpTest',
        schema: { properties: { x: { type: 'string' } } },
        buildCommand: () => ''
      });
      const help = executor.getHelp('help_test');
      expect(help).toContain('HelpTest');
      expect(help).toContain('x');
    });

    it('lists all actions', () => {
      executor.registerAction({ name: 'a', description: 'A', schema: null, buildCommand: () => '' });
      const help = executor.getHelp();
      expect(help).toContain('a');
    });

    it('returns stats', () => {
      const stats = executor.getStats();
      expect(stats).toHaveProperty('totalActions');
      expect(stats).toHaveProperty('cacheSize');
    });
  });
});

describe('bash_action Tool Registration', () => {
  let ctx: ExtensionContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('registers tool correctly', () => {
    const api = { registerTool: vi.fn() };
    BashActions.registerBashAction(api);
    expect(api.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bash_action', label: 'Bash Action' })
    );
  });

  it('creates tool with proper structure', () => {
    const tool = BashActions.createBashActionTool();
    expect(tool.name).toBe('bash_action');
    expect(tool.execute).toBeDefined();
    expect(tool.renderResult).toBeDefined();
    expect(tool.parameters.type).toBe('object');
  });
});
