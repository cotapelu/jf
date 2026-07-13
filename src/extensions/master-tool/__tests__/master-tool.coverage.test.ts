import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMasterTool,
  getRegistry,
  resetRegistry,
  registerMasterTool
} from '../master-tool.js';
import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
  Theme
} from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';

// Mock renderer helpers to capture output
function captureRenderResult(
  result: AgentToolResult<any>,
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme
): string {
  const renderer = createMasterTool().renderResult(result, options, theme);
  // Text.toString() or we can inspect its properties; for simplicity, we'll use Text.text if available
  if ('text' in renderer) {
    return (renderer as any).text;
  }
  // Text from pi-tui may have different structure; we'll approximate
  return String(renderer);
}

function createMockTheme(): Theme {
  return {
    fg: (color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
    dim: (text: string) => `dim:${text}`,
    underline: (text: string) => text,
    reset: (text: string) => text
  } as any;
}

describe('MasterTool Coverage Gaps', () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe('getRegistry singleton', () => {
    it('creates new registry when none exists', () => {
      const r1 = getRegistry({});
      const r2 = getRegistry({});
      // Both return same singleton
      expect(r1).toBe(r2);
    });

    it('resetRegistry clears global', () => {
      const r1 = getRegistry({});
      resetRegistry();
      const r2 = getRegistry({});
      expect(r1).not.toBe(r2);
    });
  });

  describe('Tool Definition', () => {
    it('has correct promptGuidelines and parameters', () => {
      const tool = createMasterTool();
      // Description contains the unified access message
      expect(tool.description).toContain('Unified access');
      expect(tool.promptGuidelines).toContain('**Structure**:');
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          command: { type: 'string' },
          args: { type: 'object' }
        },
        required: ['command', 'args']
      });
    });
  });

  describe('execute() validation', () => {
    it('returns error when command param missing', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', {} as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: command');
    });

    it('returns error when command is not string', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 123, args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('command');
    });
  });

  describe('execute() registry init failure', () => {
    it('handles registry.ensureInitialized rejection', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockRejectedValue(new Error('init fail'));

      const result = await tool.execute('id', { command: 'list', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to initialize command registry');
    });
  });

  describe('execute() meta-commands', () => {
    it('handles "list" meta-command', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getCommandList').mockReturnValue([
        { name: 'test.exec', description: 'Test', category: 'test' }
      ]);
      vi.spyOn(registry.getExecutor(), 'listCommandsByCategory').mockReturnValue(new Map([
        ['test', ['test.exec']]
      ]));

      const result = await tool.execute('id', { command: 'list', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Available Commands');
    });

    it('handles "list.grep" with query and category', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getCommandList').mockReturnValue([
        { name: 'git.status', description: 'Git status', category: 'git' },
        { name: 'test.exec', description: 'Test', category: 'test' }
      ]);

      const result = await tool.execute('id', { command: 'list.grep', args: { query: 'git', category: 'git' } } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 1 commands');
    });

    it('handles "help" with valid command', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getCommandHelp').mockReturnValue('Usage: git.status()');

      const result = await tool.execute('id', { command: 'help', args: { command: 'git.status' } } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Usage: git.status()');
    });

    it('handles "help" with missing command argument', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 'help', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing command parameter');
    });

    it('handles "help" for non-existent command', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getCommandHelp').mockReturnValue(null);

      const result = await tool.execute('id', { command: 'help', args: { command: 'unknown' } } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Command not found');
    });

    it('handles "stats" meta-command', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getStats').mockReturnValue({
        registeredCommands: 10,
        totalExecutions: 100,
        successRate: 99.5,
        cacheStats: { size: 2, entries: [{ name: 'cmd1', loadCount: 5, ageMs: 1000 }, { name: 'cmd2', loadCount: 3, ageMs: 2000 }] },
        recentErrors: []
      });

      const result = await tool.execute('id', { command: 'stats', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Registered commands: 10');
      expect(result.content[0].text).toContain('Success rate: 99.5%');
    });

    it('handles "stats" with recent errors', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getStats').mockReturnValue({
        registeredCommands: 5,
        totalExecutions: 50,
        successRate: 90,
        cacheStats: { size: 1, entries: [] },
        recentErrors: [{ command: 'cmd.err', error: 'fail', count: 2 }]
      });

      const result = await tool.execute('id', { command: 'stats', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Recent Errors');
      expect(result.content[0].text).toContain('cmd.err');
    });

    it('handles "reload" meta-command', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      const clearCacheSpy = vi.spyOn(registry, 'clearCache').mockImplementation(() => {});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);

      const result = await tool.execute('id', { command: 'reload', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('cache cleared');
      expect(clearCacheSpy).toHaveBeenCalled();
    });

    it('handles unknown meta-command (falls through to registry)', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'execute').mockResolvedValue({
        content: [{ type: 'text', text: 'Not found' }],
        details: { error: 'command_not_found' },
        isError: true
      });

      const result = await tool.execute('id', { command: 'unknown.meta', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(true);
      // It goes to registry.execute, which returns error
      expect(result.details?.error).toBe('command_not_found');
    });
  });

  describe('execute() regular command', () => {
    it('executes command via registry and returns result', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'execute').mockResolvedValue({
        content: [{ type: 'text', text: 'Command output' }],
        details: { command: 'test.exec', code: 0, duration: 123 },
        isError: false
      });

      const result = await tool.execute('id', { command: 'test.exec', args: { foo: 'bar' } } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Command output');
      expect(result.details?.command).toBe('test.exec');
    });

    it('propagates command error result', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'execute').mockResolvedValue({
        content: [{ type: 'text', text: 'Error output' }],
        details: { command: 'test.err', code: 1, error: 'Something failed' },
        isError: true
      });

      const result = await tool.execute('id', { command: 'test.err', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error output');
    });

    it('forwards args as empty object when undefined', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      const executeSpy = vi.spyOn(registry, 'execute').mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        details: { command: 'test', code: 0 },
        isError: false
      });

      await tool.execute('id', { command: 'test', args: undefined } as any, undefined, undefined, {} as any);
      expect(executeSpy).toHaveBeenCalledWith('test', {}, expect.anything());
    });
  });

  describe('renderResult()', () => {
    const theme = createMockTheme();

    it('shows spinner when isPartial true', () => {
      const tool = createMasterTool();
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: 'partial' }],
        details: { command: 'test' },
        isError: false
      };
      const rendered = captureRenderResult(result, { expanded: false, isPartial: true }, theme);
      expect(rendered).toContain('Executing');
    });

    it('shows error format when isError', () => {
      const tool = createMasterTool();
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: 'error details' }],
        details: { command: 'test.err', error: 'failure reason' },
        isError: true
      };
      const rendered = captureRenderResult(result, { expanded: false, isPartial: false }, theme);
      expect(rendered).toContain('failed');
    });

    it('shows success with exit code', () => {
      const tool = createMasterTool();
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: 'output' }],
        details: { command: 'test', code: 0 },
        isError: false
      };
      const rendered = captureRenderResult(result, { expanded: false, isPartial: false }, theme);
      expect(rendered).toContain('completed');
      expect(rendered).toContain('exit 0');
    });

    it('shows duration when present', () => {
      const tool = createMasterTool();
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: 'output' }],
        details: { command: 'test', code: 0, duration: 1234 },
        isError: false
      };
      const rendered = captureRenderResult(result, { expanded: false, isPartial: false }, theme);
      expect(rendered).toContain('Duration');
      expect(rendered).toContain('1234');
    });

    it('truncates stdout when not expanded and many lines', () => {
      const tool = createMasterTool();
      const manyLines = Array(20).fill('line').join('\n');
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: manyLines }],
        details: { command: 'test', code: 0 },
        isError: false
      };
      const rendered = captureRenderResult(result, { expanded: false, isPartial: false }, theme);
      expect(rendered).toContain('... and');
      expect(rendered).not.toContain('line\nline\nline\nline\nline\nline\nline\nline\nline\nline\nline');
    });

    it('shows all lines when expanded', () => {
      const tool = createMasterTool();
      const manyLines = Array(20).fill('line').join('\n');
      const result: AgentToolResult<any> = {
        content: [{ type: 'text', text: manyLines }],
        details: { command: 'test', code: 0 },
        isError: false
      };
      const rendered = captureRenderResult(result, { expanded: true, isPartial: false }, theme);
      expect(rendered).toContain('line');
      expect(rendered).not.toContain('... and');
    });

    it('handles empty stdout (still shows success line)', () => {
      const tool = createMasterTool();
      const result: AgentToolResult<any> = {
        content: [],
        details: { command: 'test', code: 0 },
        isError: false
      };
      const rendered = captureRenderResult(result, { expanded: false, isPartial: false }, theme);
      // Even with no stdout, success line with exit code is shown
      expect(rendered).toContain('completed');
    });
  });

  describe('handleGrepCommand edge cases', () => {
    it('returns "no results" style output when none match', async () => {
      // Access internal via registry? Not directly. We'll test through execute path by mocking registry.getCommandList
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getCommandList').mockReturnValue([
        { name: 'git.status', description: 'Git status', category: 'git' }
      ]);

      // Search for non-matching query
      const result = await tool.execute('id', { command: 'list.grep', args: { query: 'nonexistent' } } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 0 commands');
    });

    it('handles category filter without query', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getCommandList').mockReturnValue([
        { name: 'git.status', description: 'Git status', category: 'git' },
        { name: 'test.exec', description: 'Test exec', category: 'test' }
      ]);

      const result = await tool.execute('id', { command: 'list.grep', args: { category: 'git' } } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 1 commands');
      expect(result.content[0].text).toContain('git.status');
    });
  });

  describe('handleStatsCommand edge cases', () => {
    it('handles empty cache and errors', async () => {
      const tool = createMasterTool();
      const registry = getRegistry({});
      vi.spyOn(registry, 'ensureInitialized').mockResolvedValue(undefined);
      vi.spyOn(registry, 'getStats').mockReturnValue({
        registeredCommands: 0,
        totalExecutions: 0,
        successRate: 0,
        cacheStats: { size: 0, entries: [] },
        recentErrors: []
      });

      const result = await tool.execute('id', { command: 'stats', args: {} } as any, undefined, undefined, {} as any);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Registered commands: 0');
    });
  });

  describe('registerMasterTool', () => {
    it('registers tool with api', () => {
      const api = {
        registerTool: vi.fn(),
        getCapabilityRegistry: vi.fn(() => null)
      } as any;
      registerMasterTool(api);
      expect(api.registerTool).toHaveBeenCalled();
    });
  });
});
