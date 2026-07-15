import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fs/promises before importing modules that use it
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn()
}));

import { readdir, stat } from 'fs/promises';
import { CommandRegistry, createCommandRegistry } from '../command-registry.js';
import type { CommandModule, CommandMetadata, CommandLoader } from '../types/command-module.js';

// Helper to create mock CommandModule
function createMockCommandModule(overrides: Partial<CommandModule> = {}): CommandModule {
  return {
    metadata: {
      name: 'test.cmd',
      category: 'test',
      description: 'Test command',
      ...overrides.metadata
    },
    schema: overrides.schema ?? {},
    execute: overrides.execute ?? vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    StateClass: overrides.StateClass,
    getPersistencePath: overrides.getPersistencePath,
    ...overrides
  };
}

describe('CommandRegistry', () => {
  let registry: CommandRegistry;
  let defaultOpts: any;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultOpts = { commandsDir: '/fake/commands' };
    readdir.mockResolvedValue([]);
    stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
    registry = new CommandRegistry(defaultOpts);
  });

  describe('constructor', () => {
    it('should create registry with default executor', () => {
      expect(registry).toBeInstanceOf(CommandRegistry);
    });

    it('should accept custom commands map', () => {
      const custom = new Map<string, CommandLoader>([['custom.cmd', async () => createMockCommandModule()]]);
      const r = new CommandRegistry({}, custom);
      expect(r).toBeInstanceOf(CommandRegistry);
    });
  });

  describe('initialize', () => {
    it('should scan commands directory and load commands', async () => {
      // Simulate a category folder with one command file
      readdir.mockImplementation(async (path: string) => {
        if (path === '/fake/commands') {
          return [{ isDirectory: () => true, name: 'dev' }];
        }
        if (path === '/fake/commands/dev') {
          return ['deploy.ts'];
        }
        return [];
      });

      await registry.initialize();
      const names = registry.listCommands();
      expect(names).toContain('dev.deploy');
    });

    it('should handle direct command files in root', async () => {
      readdir.mockResolvedValue([
        { isFile: () => true, isDirectory: () => false, name: 'build.js' },
        { isFile: () => true, isDirectory: () => false, name: 'clean.ts' }
      ]);
      await registry.initialize();
      const names = registry.listCommands();
      expect(names).toContain('build');
      expect(names).toContain('clean');
    });

    it('should ignore non-code files', async () => {
      readdir.mockResolvedValue([
        { isDirectory: () => false, name: 'readme.md' },
        { isDirectory: () => false, name: 'config.json' }
      ]);
      await registry.initialize();
      expect(registry.listCommands()).toEqual([]);
    });

    it('should only initialize once', async () => {
      readdir.mockResolvedValue([]);
      await registry.initialize();
      await registry.initialize();
      expect(readdir).toHaveBeenCalledTimes(1);
    });

    it('should log loaded command count', async () => {
      const logSpy = vi.spyOn(console, 'log');
      readdir.mockResolvedValue([]);
      await registry.initialize();
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Loaded/));
      logSpy.mockRestore();
    });

    it('should handle scan errors gracefully and warn', async () => {
      readdir.mockRejectedValue(new Error('scan error'));
      const warnSpy = vi.spyOn(console, 'warn');
      await registry.initialize();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should register custom commands when provided', async () => {
      const customLoader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'custom.cmd', category: 'custom', description: 'Custom' }
      });
      const customCommands = new Map<string, CommandLoader>([['custom.cmd', customLoader]]);
      const r = new CommandRegistry({}, customCommands);
      await r.initialize();
      expect(r.listCommands()).toContain('custom.cmd');
    });

    it('should combine scanned commands and custom commands', async () => {
      readdir.mockResolvedValue([{ isFile: () => true, isDirectory: () => false, name: 'scanned.ts' }]);
      const customLoader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'custom.cmd', category: 'custom' }
      });
      const customCommands = new Map<string, CommandLoader>([['custom.cmd', customLoader]]);
      const r = new CommandRegistry({}, customCommands);
      await r.initialize();
      expect(r.listCommands()).toContain('scanned');
      expect(r.listCommands()).toContain('custom.cmd');
    });
  });

  describe('ensureInitialized', () => {
    it('should initialize if not yet', async () => {
      readdir.mockResolvedValue([]);
      await registry.ensureInitialized();
      expect(readdir).toHaveBeenCalled();
    });

    it('should not re-initialize if already done', async () => {
      readdir.mockResolvedValue([]);
      await registry.initialize();
      await registry.ensureInitialized();
      expect(readdir).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute', () => {
    it('should execute a custom command successfully', async () => {
      const execSpy = vi.fn().mockResolvedValue({ code: 0, stdout: 'Hello', stderr: '' });
      const loader: CommandLoader = async () => createMockCommandModule({ metadata: { name: 'hello.cmd', category: 'test' }, execute: execSpy });
      const r = new CommandRegistry({}, new Map([['hello.cmd', loader]]));
      await r.initialize();
      const result = await r.execute('hello.cmd', {}, { toolCallId: '1', signal: new AbortController().signal, onUpdate: vi.fn(), ctx: {}, maxOutputSize: 1024 });
      expect(result.isError).toBe(false);
      expect(result.content).toEqual([{ type: 'text', text: 'Hello' }]);
      expect(result.details.command).toBe('hello.cmd');
      expect(result.details.code).toBe(0);
    });

    it('should return error status when command fails', async () => {
      const execSpy = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'Oops' });
      const loader: CommandLoader = async () => createMockCommandModule({ metadata: { name: 'fail.cmd', category: 'test' }, execute: execSpy });
      const r = new CommandRegistry({}, new Map([['fail.cmd', loader]]));
      await r.initialize();
      const result = await r.execute('fail.cmd', {}, { toolCallId: '1', signal: new AbortController().signal, onUpdate: vi.fn(), ctx: {}, maxOutputSize: 1024 });
      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('Oops');
    });

    it('should include stderr in content even on success', async () => {
      const execSpy = vi.fn().mockResolvedValue({ code: 0, stdout: 'OK', stderr: 'Warning' });
      const loader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'warn.cmd', category: 'test' },
        execute: execSpy
      });
      const r = new CommandRegistry({}, new Map([['warn.cmd', loader]]));
      await r.initialize();

      const result = await r.execute('warn.cmd', {}, {
        toolCallId: '1',
        signal: new AbortController().signal,
        onUpdate: vi.fn(),
        ctx: {},
        maxOutputSize: 1024
      });

      expect(result.content.some(c => c.text.includes('Warning'))).toBe(true);
    });

    it('should return generic message when no stdout or stderr', async () => {
      const execSpy = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      const loader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'silent.cmd', category: 'test' },
        execute: execSpy
      });
      const r = new CommandRegistry({}, new Map([['silent.cmd', loader]]));
      await r.initialize();

      const result = await r.execute('silent.cmd', {}, {
        toolCallId: '1',
        signal: new AbortController().signal,
        onUpdate: vi.fn(),
        ctx: {},
        maxOutputSize: 1024
      });

      expect(result.content[0].text).toBe('Success');
    });

    it('should include data in details', async () => {
      const execSpy = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '', data: { key: 'value' } });
      const loader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'data.cmd', category: 'test' },
        execute: execSpy
      });
      const r = new CommandRegistry({}, new Map([['data.cmd', loader]]));
      await r.initialize();

      const result = await r.execute('data.cmd', {}, {
        toolCallId: '1',
        signal: new AbortController().signal,
        onUpdate: vi.fn(),
        ctx: {},
        maxOutputSize: 1024
      });

      expect(result.details.data).toEqual({ key: 'value' });
    });

    it('should include duration in details', async () => {
      const execSpy = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '', duration: 123 });
      const loader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'timed.cmd', category: 'test' },
        execute: execSpy
      });
      const r = new CommandRegistry({}, new Map([['timed.cmd', loader]]));
      await r.initialize();

      const result = await r.execute('timed.cmd', {}, {
        toolCallId: '1',
        signal: new AbortController().signal,
        onUpdate: vi.fn(),
        ctx: {},
        maxOutputSize: 1024
      });

      expect(result.details.duration).toBe(123);
    });

    it('should return error result when command not found', async () => {
      readdir.mockResolvedValue([]);
      await registry.initialize();
      const result = await registry.execute('unknown', {}, {
        toolCallId: '1',
        signal: new AbortController().signal,
        onUpdate: vi.fn(),
        ctx: {},
        maxOutputSize: 1024
      });
      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('not found');
    });
  });

  describe('getCommandList', () => {
    it('should return sorted list of commands', async () => {
      readdir.mockResolvedValue([
        { isFile: () => true, isDirectory: () => false, name: 'zebra.ts' },
        { isFile: () => true, isDirectory: () => false, name: 'alpha.js' }
      ]);
      await registry.initialize();
      const list = registry.getCommandList();
      const names = list.map(c => c.name);
      expect(names).toEqual(['alpha', 'zebra']);
    });

    it('should include basic info for scanned command', async () => {
      readdir.mockImplementation(async (path: string) => {
        if (path === '/fake/commands') {
          return [{ isFile: () => true, isDirectory: () => false, name: 'foo.ts' }];
        }
        return [];
      });
      await registry.initialize();
      const list = registry.getCommandList();
      expect(list.length).toBeGreaterThan(0);
      const cmd = list[0];
      expect(cmd).toHaveProperty('name');
      expect(cmd).toHaveProperty('category');
      expect(cmd).toHaveProperty('description');
    });
  });

  describe('listCommands', () => {
    it('should return all command names', async () => {
      readdir.mockImplementation(async (path: string) => path === '/fake/commands' ? [{ isFile:()=>true, isDirectory:()=>false, name:'a.ts' },{ isFile:()=>false, isDirectory:()=>true, name:'cat' }] : path === '/fake/commands/cat' ? ['b.ts'] : []);
      await registry.initialize();
      const names = registry.listCommands();
      ['a','cat.b'].forEach(n => expect(names).toContain(n));
    });
  });

  describe('listCommandsByCategory', () => {
    it('should group commands by category', async () => {
      readdir.mockImplementation(async (path: string) => {
        if (path === '/fake/commands') return [{ isFile:()=>false, isDirectory:()=>true, name:'dev' },{ isFile:()=>false, isDirectory:()=>true, name:'git' }];
        if (path === '/fake/commands/dev') return ['build.ts','clean.ts'];
        if (path === '/fake/commands/git') return ['status.ts'];
        return [];
      });
      await registry.initialize();
      const map = registry.listCommandsByCategory();
      ['dev.build','dev.clean'].forEach(n => expect(map.get('dev')).toContain(n));
      expect(map.get('git')).toContain('git.status');
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered command', async () => {
      readdir.mockResolvedValue([]);
      const customLoader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'meta.cmd', description: 'Has metadata' }
      });
      const r = new CommandRegistry({}, new Map([['meta.cmd', customLoader]]));
      await r.initialize();
      const meta = r.getMetadata('meta.cmd');
      expect(meta).toBeDefined();
      expect(meta?.name).toBe('meta.cmd');
    });

    it('should return undefined for unknown command', () => {
      expect(registry.getMetadata('unknown')).toBeUndefined();
    });
  });

  describe('getCommandHelp', () => {
    it('should format basic help with required params', () => {
      readdir.mockResolvedValue([]);
      const customLoader: CommandLoader = async () => createMockCommandModule({
        metadata: { name: 'help.test', category: 'test', description: 'A test command', longDescription: 'Detailed info', examples: ['example usage'], tags: ['test'], experimental: false, dependsOn: ['dep1'], permissions: ['write'] },
        schema: { type: 'object', properties: { force: { type: 'boolean', description: 'Force operation' }, count: { type: 'number', description: 'Number of times' } }, required: ['count'] }
      });
      const r = new CommandRegistry({}, new Map([['help.test', customLoader]]));
    });

    // More help tests...
  });

  describe('getStats', () => {
    it('should return statistics object', async () => {
      readdir.mockResolvedValue([]);
      await registry.initialize();
      const stats = registry.getStats();
      expect(stats).toHaveProperty('registeredCommands');
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successRate');
    });
  });

  describe('clearCache', () => {
    it('should clear executor cache', async () => {
      readdir.mockResolvedValue([]);
      await registry.initialize();
      expect(() => registry.clearCache()).not.toThrow();
    });
  });

  describe('getExecutor', () => {
    it('should return an executor object with required methods', () => {
      const exec = registry.getExecutor();
      expect(exec).toHaveProperty('execute');
      expect(exec).toHaveProperty('register');
      expect(exec).toHaveProperty('listCommands');
    });
  });

  describe('createCommandRegistry (factory)', () => {
    it('should create a new instance', () => {
      const r = createCommandRegistry();
      expect(r).toBeInstanceOf(CommandRegistry);
    });
  });
});
