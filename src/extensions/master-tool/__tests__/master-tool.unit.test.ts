import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMasterTool, getRegistry, resetRegistry } from '../master-tool.js';
import type { ExtensionContext, AgentToolResult, AgentToolUpdateCallback, Theme } from '@earendil-works/pi-coding-agent';
import type { CommandRegistry } from '../command-registry.js';

type ExecuteFn = (
  toolCallId: string,
  params: { command: string; args: any },
  signal?: AbortSignal | undefined,
  onUpdate?: AgentToolUpdateCallback<unknown> | undefined,
  ctx?: ExtensionContext
) => Promise<AgentToolResult<any>>;

describe('MasterTool (Unit)', () => {
  let tool: ReturnType<typeof createMasterTool>;
  let execute: ExecuteFn;
  let registry: CommandRegistry;

  beforeEach(() => {
    resetRegistry();

    // Obtain the registry instance
    registry = getRegistry({}) as any;

    // Create a mock function for executor.listCommandsByCategory
    const mockListCommandsByCategory = vi.fn(() => new Map([
      ['test', ['test.exec']],
      ['meta', ['list']],
    ]));

    // Default stubs for registry methods
    vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
    vi.spyOn(registry, 'getCommandList').mockReturnValue([
      { name: 'test.exec', description: 'Test exec', category: 'test' },
      { name: 'list', description: 'List commands', category: 'meta' },
    ]);
    vi.spyOn(registry, 'getExecutor').mockReturnValue({
      listCommandsByCategory: mockListCommandsByCategory,
    } as any);
    // Keep a reference to the mock function for later assertions/overrides
    (registry as any).mockListCommandsByCategory = mockListCommandsByCategory;

    vi.spyOn(registry, 'getCommandHelp').mockReturnValue('Help for test.exec');
    vi.spyOn(registry, 'getStats').mockReturnValue({
      registeredCommands: 1,
      totalExecutions: 0,
      successRate: 100,
      cacheStats: { size: 0, entries: [] },
      recentErrors: [],
    });
    vi.spyOn(registry, 'clearCache').mockImplementation(() => {});
    vi.spyOn(registry, 'execute').mockResolvedValue({
      content: [{ type: 'text', text: 'OK' }],
      details: { command: 'test.exec', code: 0 },
      isError: false,
    });

    tool = createMasterTool();
    execute = tool.execute as ExecuteFn;
  });

  describe('Tool Definition', () => {
    it('has correct metadata', () => {
      expect(tool.name).toBe('master_tool');
      expect(tool.label).toBe('Master Tool');
      expect(tool.description).toContain('Unified access');
      expect(tool.parameters).toEqual({
        type: 'object',
        properties: {
          command: { type: 'string', description: expect.any(String) },
          args: { type: 'object', description: expect.any(String) },
        },
        required: ['command', 'args'],
      });
    });
  });

  describe('execute()', () => {
    it('returns error if command parameter missing', async () => {
      const result = await execute('id', {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: command');
    });

    it('returns error if command not a string', async () => {
      const result = await execute('id', { command: 123, args: {} } as any);
      expect(result.isError).toBe(true);
    });

    it('handles registry initialization failure', async () => {
      (registry.ensureInitialized as any).mockRejectedValue(new Error('init fail'));
      const result = await execute('id', { command: 'list', args: {} } as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to initialize command registry');
    });

    describe('meta-commands', () => {
      it('handles "list"', async () => {
        const result = await execute('id', { command: 'list', args: {} } as any);
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('Available Commands');
        expect(registry.getCommandList).toHaveBeenCalled();
        expect(registry.getExecutor).toHaveBeenCalled();
        const mockList = (registry as any).mockListCommandsByCategory;
        expect(mockList).toHaveBeenCalled();
      });

      it('handles "list.grep" with query only', async () => {
        const result = await execute('id', { command: 'list.grep', args: { query: 'test' } } as any);
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('Found 1 commands');
        expect(registry.getCommandList).toHaveBeenCalled();
      });

      it('handles "list.grep" with category only', async () => {
        const result = await execute('id', { command: 'list.grep', args: { category: 'test' } } as any);
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('Found 1 commands');
      });

      it('handles "list.grep" with both query and category', async () => {
        (registry.getCommandList as any).mockReturnValue([
          { name: 'test.exec', description: 'Test', category: 'test' },
          { name: 'git.status', description: 'Git status', category: 'git' },
        ]);
        const result = await execute('id', { command: 'list.grep', args: { query: 'test', category: 'test' } } as any);
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('Found 1 commands');
      });

      it('handles "help" with missing command param', async () => {
        const result = await execute('id', { command: 'help', args: {} } as any);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Missing command parameter');
      });

      it('handles "help" for existing command', async () => {
        (registry.getCommandHelp as any).mockReturnValue('This is help for test.exec');
        const result = await execute('id', { command: 'help', args: { command: 'test.exec' } } as any);
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toBe('This is help for test.exec');
        expect(registry.getCommandHelp).toHaveBeenCalledWith('test.exec');
      });

      it('handles "help" for unknown command', async () => {
        (registry.getCommandHelp as any).mockReturnValue(null);
        const result = await execute('id', { command: 'help', args: { command: 'unknown.cmd' } } as any);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Command not found: unknown.cmd');
      });

      it('handles "stats"', async () => {
        (registry.getStats as any).mockReturnValue({
          registeredCommands: 5,
          totalExecutions: 123,
          successRate: 98.5,
          cacheStats: { size: 2, entries: [{ name: 'cmd1', loadCount: 10, ageMs: 5000 }] },
          recentErrors: [],
        });
        const result = await execute('id', { command: 'stats', args: {} } as any);
        expect(result.isError).toBe(false);
        const text = result.content[0].text;
        expect(text).toContain('Master Tool Statistics');
        expect(text).toContain('Registered commands: 5');
        expect(text).toContain('Total executions: 123');
        expect(text).toContain('Success rate: 98.5%');
      });

      it('handles "reload"', async () => {
        const result = await execute('id', { command: 'reload', args: {} } as any);
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('Command cache cleared');
        expect(registry.clearCache).toHaveBeenCalled();
        await Promise.resolve(); // flush microtasks
        expect(registry.ensureInitialized).toHaveBeenCalled();
      });


    });

    describe('regular command execution', () => {
      it('dispatches to registry.execute', async () => {
        (registry.execute as any).mockResolvedValue({
          content: [{ type: 'text', text: 'Command output' }],
          details: { command: 'dev.test', duration: 100 },
          isError: false,
        });
        const result = await execute('id', { command: 'dev.test', args: { files: ['src/'] } } as any);
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toBe('Command output');
        expect(registry.execute).toHaveBeenCalledWith('dev.test', { files: ['src/'] }, expect.any(Object));
      });

      it('propagates errors from registry.execute', async () => {
        (registry.execute as any).mockResolvedValue({
          content: [{ type: 'text', text: 'Execution failed' }],
          details: { error: 'command_error' },
          isError: true,
        });
        const result = await execute('id', { command: 'bad.cmd', args: {} } as any);
        expect(result.isError).toBe(true);
        expect(result.details?.error).toBe('command_error');
      });

      it('handles undefined args gracefully', async () => {
        const result = await execute('id', { command: 'any.cmd', args: undefined } as any);
        expect(result.isError).toBe(false);
        expect(registry.execute).toHaveBeenCalledWith('any.cmd', {}, expect.any(Object));
      });
    });
  });

  describe('renderCall()', () => {
    it('renders command and args count', () => {
      const mockTheme: Theme = {
        fg: (color: string, text: string) => (color === 'accent' ? `[${text}]` : text),
        bold: (text: string) => `*${text}*`,
        dim: (text: string) => `(${text})`,
      } as any;
      const rendered = tool.renderCall({ command: 'git.status', args: { repo: '.' } }, mockTheme);
      expect(rendered).toBeDefined();
    });
  });

  describe('renderResult()', () => {
    beforeEach(() => {
      tool = createMasterTool({});
    });

    it('renders partial (executing) state', () => {
      const mockTheme: Theme = {
        fg: (color: string, text: string) => (color === 'warning' ? `!${text}!` : text),
      } as any;
      const result: AgentToolResult<any> = {
        content: [],
        details: { command: 'test' },
        isError: false,
      };
      const rendered = tool.renderResult(result, { expanded: false, isPartial: true }, mockTheme);
      expect(rendered).toBeDefined();
    });

    it('renders error result', () => {
      const mockTheme: Theme = {
        fg: (color: string, text: string) => (color === 'error' ? `E${text}E` : text),
      } as any;
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: 'Something broke' }],
        details: { error: 'boom' },
        isError: true,
      };
      const rendered = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(rendered).toBeDefined();
    });

    it('renders success result with exit code', () => {
      const mockTheme: Theme = {
        fg: (color: string, text: string) => text,
      } as any;
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: 'Hello\nWorld' }],
        details: { command: 'echo', code: 0 },
        isError: false,
      };
      const rendered = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(rendered).toBeDefined();
    });

    it('truncates long output in non-expanded mode', () => {
      const mockTheme: Theme = {
        fg: (color: string, text: string) => text,
      } as any;
      const manyLines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: manyLines }],
        details: {},
        isError: false,
      };
      const rendered = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(rendered).toBeDefined();
    });

    it('shows more lines in expanded mode', () => {
      const mockTheme: Theme = {
        fg: (color: string, text: string) => text,
      } as any;
      const manyLines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: manyLines }],
        details: {},
        isError: false,
      };
      const rendered = tool.renderResult(result, { expanded: true, isPartial: false }, mockTheme);
      expect(rendered).toBeDefined();
    });
  });
});
