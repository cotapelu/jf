import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Helper to reset the shared mock and return the mockExecute function
function resetMock() {
  const mockExecute = vi.fn().mockResolvedValue({
    isError: false,
    content: [{ type: 'text', text: 'output' }],
    details: { code: 0, stderr: '' }
  });
  (createBashToolDefinition as any).mockReturnValue({ execute: mockExecute });
  return mockExecute;
}

describe('bash-actions coverage gaps', () => {
  let executor: BashActionExecutor;
  let ctx: ExtensionContext;
  let mockExecute: any;

  beforeEach(() => {
    ctx = createMockContext();
    mockExecute = resetMock();
    executor = new BashActionExecutor(ctx, { cacheSize: 3, cacheDefaultTTL: 1000 });
  });

  describe('Cache', () => {
    it('respects ttl=0 (no caching)', async () => {
      executor = new BashActionExecutor(ctx);
      executor.registerAction({
        name: 'nocache',
        description: 'NoCache',
        schema: null,
        buildCommand: () => 'echo ok',
        options: { cache: { ttl: 0 } }
      });
      await executor.execute('nocache', {});
      await executor.execute('nocache', {});
      const stats = executor.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(2);
    });

    it('evicts LRU when capacity exceeded', async () => {
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
      await executor.execute('cmd', { id: 3 }); // evicts id=1
      // Should have 2 misses, then cache hits for id=2 and id=3
      let stats = executor.getStats();
      expect(stats.cacheMisses).toBeGreaterThanOrEqual(3);
      await executor.execute('cmd', { id: 2 });
      await executor.execute('cmd', { id: 3 });
      stats = executor.getStats();
      expect(stats.cacheHits).toBe(2);
    });
  });

  describe('Execution errors', () => {
    it('throws when buildCommand returns null', async () => {
      executor.registerAction({ name: 'bad', description: 'Bad', schema: null, buildCommand: () => null as any });
      await expect(executor.execute('bad', {})).rejects.toThrow('invalid command');
    });

    it('throws when buildCommand returns non-string', async () => {
      executor.registerAction({ name: 'bad2', description: 'Bad2', schema: null, buildCommand: () => 123 as any });
      await expect(executor.execute('bad2', {})).rejects.toThrow('invalid command');
    });

    it('throws when result.isError is true', async () => {
      mockExecute.mockResolvedValueOnce({
        isError: true,
        content: [{ type: 'text', text: 'cmd failed' }],
        details: { code: 1, stderr: 'err' }
      });
      executor.registerAction({ name: 'err', description: 'Err', schema: null, buildCommand: () => 'cmd' });
      await expect(executor.execute('err', {})).rejects.toThrow('cmd failed');
    });

    it('does not cache non-zero exit codes', async () => {
      mockExecute.mockResolvedValueOnce({
        isError: false,
        content: [{ type: 'text', text: 'output' }],
        details: { code: 1, stderr: 'fail' }
      });
      executor.registerAction({
        name: 'failcode',
        description: 'FailCode',
        schema: null,
        buildCommand: () => 'cmd',
        options: { cache: { ttl: 5000 } }
      });
      await executor.execute('failcode', {});
      let stats = executor.getStats();
      expect(stats.cacheMisses).toBe(1);
      await executor.execute('failcode', {});
      stats = executor.getStats();
      expect(stats.cacheMisses).toBe(2);
    });
  });

  describe('Rate limiting', () => {
    it('enforces limit', async () => {
      resetMock();
      executor = new BashActionExecutor(ctx);
      executor.registerAction({
        name: 'limited',
        description: 'Limited',
        schema: null,
        buildCommand: () => 'cmd',
        options: { cache: { ttl: 0 }, rateLimit: { max: 1, windowMs: 60000 } }
      });
      await executor.execute('limited', {}); // token consumed
      await expect(executor.execute('limited', {})).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('validateArgs', () => {
    it('catches exceptions during schema.required access', () => {
      const executorAny = executor as any;
      const badSchema: any = {};
      Object.defineProperty(badSchema, 'required', {
        get: () => { throw new Error('schema required access error'); }
      });
      const result = executorAny.validateArgs({}, badSchema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('enforces type string', () => {
      const executorAny = executor as any;
      const schema = { properties: { name: { type: 'string' } } };
      expect(executorAny.validateArgs({ name: 'hello' }, schema).valid).toBe(true);
      const bad = executorAny.validateArgs({ name: 123 }, schema);
      expect(bad.valid).toBe(false);
      expect(bad.errors[0].message).toBe('Must be string');
    });

    it('enforces type number', () => {
      const executorAny = executor as any;
      const schema = { properties: { age: { type: 'number' } } };
      expect(executorAny.validateArgs({ age: 25 }, schema).valid).toBe(true);
      const bad = executorAny.validateArgs({ age: 'old' }, schema);
      expect(bad.valid).toBe(false);
      expect(bad.errors[0].message).toBe('Must be number');
    });

    it('enforces type boolean', () => {
      const executorAny = executor as any;
      const schema = { properties: { flag: { type: 'boolean' } } };
      expect(executorAny.validateArgs({ flag: true }, schema).valid).toBe(true);
      const bad = executorAny.validateArgs({ flag: 'yes' }, schema);
      expect(bad.valid).toBe(false);
      expect(bad.errors[0].message).toBe('Must be boolean');
    });

    it('enforces type integer', () => {
      const executorAny = executor as any;
      const schema = { properties: { count: { type: 'integer' } } };
      expect(executorAny.validateArgs({ count: 5 }, schema).valid).toBe(true);
      const bad = executorAny.validateArgs({ count: 5.5 }, schema);
      expect(bad.valid).toBe(false);
      expect(bad.errors[0].message).toBe('Must be integer');
    });

    it('enforces enum', () => {
      const executorAny = executor as any;
      const schema = { properties: { color: { type: 'string', enum: ['red', 'green'] } } };
      expect(executorAny.validateArgs({ color: 'red' }, schema).valid).toBe(true);
      const bad = executorAny.validateArgs({ color: 'blue' }, schema);
      expect(bad.valid).toBe(false);
      expect(bad.errors[0].message).toContain('Must be one of');
    });

    it('enforces minimum', () => {
      const executorAny = executor as any;
      const schema = { properties: { count: { type: 'number', minimum: 1 } } };
      expect(executorAny.validateArgs({ count: 5 }, schema).valid).toBe(true);
      const bad = executorAny.validateArgs({ count: 0 }, schema);
      expect(bad.valid).toBe(false);
      expect(bad.errors[0].message).toContain('>= 1');
    });

    it('enforces maximum', () => {
      const executorAny = executor as any;
      const schema = { properties: { count: { type: 'number', maximum: 10 } } };
      expect(executorAny.validateArgs({ count: 5 }, schema).valid).toBe(true);
      const bad = executorAny.validateArgs({ count: 15 }, schema);
      expect(bad.valid).toBe(false);
      expect(bad.errors[0].message).toContain('<= 10');
    });
  });

  describe('Metrics getters', () => {
    it('getMetrics returns null for unknown action', () => {
      const res = executor.getMetrics('nonexistent');
      expect(res).toBeNull();
    });

    it('getStats cacheHitRate zero when no requests', () => {
      const stats = executor.getStats();
      expect(stats.cacheHitRate).toBe(0);
    });
  });

  describe('Tool execute error handling', () => {
    let tool: ReturnType<typeof createBashActionTool>;

    beforeEach(() => {
      // Must be called BEFORE any tool.execute to initialize module-level actionExecutor with this mock
      mockExecute = resetMock();
      tool = createBashActionTool();
    });

    it('returns isError true when command exits non-zero (code !== 0)', async () => {
      // Mock bashTool.execute to return code 1
      mockExecute.mockResolvedValueOnce({
        isError: false,
        content: [{ type: 'text', text: 'output' }],
        details: { code: 1, stderr: 'err' }
      });
      const result = await tool.execute('tid', { action: 'shell', args: { command: 'false' } }, undefined, undefined, ctx) as AgentToolResult<any>;
      expect(result.isError).toBe(true);
      expect(result.details.code).toBe(1);
    });

    it('returns isError true for unknown action (caught error)', async () => {
      const result = await tool.execute('tid', { action: 'unknown_act', args: {} }, undefined, undefined, ctx) as AgentToolResult<any>;
      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('Unknown action');
    });
  });

  describe('renderResult branches', () => {
    let tool: ReturnType<typeof createBashActionTool>;

    beforeEach(() => {
      tool = createBashActionTool();
    });

    const mockTheme = { fg: (style: string, text: string) => text } as any;

    it('renders isPartial state', () => {
      const result: any = { details: { action: 'test' } };
      const text = tool.renderResult(result, { expanded: false, isPartial: true }, mockTheme);
      expect((text as any).content).toContain('Executing');
    });

    it('renders error when result.isError true', () => {
      const result: any = { isError: true, details: { action: 'test', error: 'boom' } };
      const text = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect((text as any).content).toContain('❌');
    });

    it('renders cached badge when details.cached true', () => {
      const result: any = { content: [{ type: 'text', text: 'ok' }], details: { cached: true, duration: 10 } };
      const text = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect((text as any).content).toContain('[CACHED]');
    });

    it('renders normal output when no flags', () => {
      const result: any = { content: [{ type: 'text', text: 'hello world' }], details: { duration: 5 } };
      const text = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect((text as any).content).toContain('hello world');
    });
  });

  describe('Tool wrapper branches', () => {
    let tool: ReturnType<typeof createBashActionTool>;

    beforeEach(() => {
      tool = createBashActionTool();
    });

    it('handles \"list\" action', async () => {
      const result = await tool.execute('test-id', { action: 'list', args: {} }, undefined, undefined, ctx) as AgentToolResult<any>;
      expect(result.isError).toBe(false);
      expect((result.content[0] as any).text).toContain('Bash Action');
    });

    it('handles \"stats\" action', async () => {
      const result = await tool.execute('test-id', { action: 'stats', args: {} }, undefined, undefined, ctx) as AgentToolResult<any>;
      expect(result.isError).toBe(false);
      expect(result.details.cacheHits !== undefined).toBe(true);
    });
  });
});
