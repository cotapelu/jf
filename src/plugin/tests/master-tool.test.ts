import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry } from '../extensions/master-tool/command-registry.js';
import { CommandExecutor } from '../extensions/master-tool/command-executor.js';
import { StateManager } from '../extensions/master-tool/state-manager.js';
import { getValidator } from '../extensions/master-tool/utils/command-validator.js';
import { Mutex } from '../extensions/master-tool/utils/mutex.js';
import { Type } from 'typebox';

describe('Master Tool Components', () => {
  describe('Mutex', () => {
    it('should lock and unlock correctly', async () => {
      const mutex = new Mutex();
      const release = await mutex.lock();
      const lock2 = mutex.lock();
      release();
      await expect(lock2).resolves.toBeDefined();
    });

    it('tryLock should work', () => {
      const mutex = new Mutex();
      expect(mutex.tryLock()).toBe(true);
      expect(mutex.tryLock()).toBe(false);
    });
  });

  describe('CommandValidator', () => {
    const validator = getValidator();

    it('should check rate limit', () => {
      const res = validator.checkRateLimit('testcmd');
      expect(res.allowed).toBe(true);
    });

    it('should detect prototype pollution', () => {
      const bad = JSON.parse('{"__proto__":{}}');
      const sec = validator.validateSecurity(bad, { name: 'test' });
      expect(sec.valid).toBe(false);
      expect(sec.errors).toContain('Potential prototype pollution detected');
    });

    it('should validate args with TypeBox schema', () => {
      const schema = Type.Object({ name: Type.String() });
      const res = validator.validateWithSchema({ name: 'Alice' }, schema);
      expect(res.valid).toBe(true);
      const res2 = validator.validateWithSchema({ name: 123 }, schema);
      expect(res2.valid).toBe(false);
      expect(res2.errors).toHaveLength(1);
    });
  });

  describe('StateManager', () => {
    let manager: StateManager;
    let mockCtx: any;

    beforeEach(() => {
      manager = new StateManager();
      mockCtx = {};
    });

    it('should create and retrieve generic state', () => {
      const state = manager.getOrCreateState('testcmd', mockCtx);
      expect(state).toBeDefined();
      expect(state.isDirty).toBe(false);
      state.markDirty();
      expect(state.isDirty).toBe(true);
    });

    it('should subscribe to state changes', () => {
      const state = manager.getOrCreateState('testcmd2', mockCtx);
      let notified = 0;
      const unsub = state.subscribe(() => { notified++; });
      state.markDirty();
      expect(notified).toBe(1);
      unsub();
      state.markDirty();
      expect(notified).toBe(1);
    });
  });

  describe('CommandRegistry', () => {
    let registry: CommandRegistry;

    beforeEach(async () => {
      registry = new CommandRegistry();
      await registry.initialize();
    });

    it('should discover commands', () => {
      const commands = registry.listCommands();
      expect(commands).toContain('git.status');
      expect(commands).toContain('dev.test');
      expect(commands).toContain('system.info');
      expect(commands).toContain('todo.manage');
      expect(commands).toContain('demo.counter');
    });

    it('should categorize commands', () => {
      const cats = registry.listCommandsByCategory();
      expect(cats.has('git')).toBe(true);
      expect(cats.has('dev')).toBe(true);
      expect(cats.has('system')).toBe(true);
      expect(cats.has('todo')).toBe(true);
      expect(cats.has('demo')).toBe(true);
    });

    it('should get metadata', () => {
      const meta = registry.getMetadata('system.info');
      expect(meta?.name).toBe('system.info');
      expect(meta?.category).toBe('system');
    });

    it('should execute system.info with default args', async () => {
      const result = await registry.execute('system.info', {} as any, {
        toolCallId: 'test',
        signal: undefined,
        onUpdate: undefined,
        ctx: {} as any,
        maxOutputSize: 1024 * 1024
      });
      expect(result.isError).toBe(false);
      const text = result.content.find(c => c.type === 'text')?.text || '';
      expect(text).toMatch(/OS:/);
    });

    it('should include detailed memory info when detailed=true', async () => {
      const result = await registry.execute('system.info', { detailed: true } as any, {
        toolCallId: 'test',
        signal: undefined,
        onUpdate: undefined,
        ctx: {} as any,
        maxOutputSize: 1024 * 1024
      });
      expect(result.isError).toBe(false);
      const text = result.content.find(c => c.type === 'text')?.text || '';
      expect(text).toContain('Total memory');
    });

    it('should reject unknown command', async () => {
      const result = await registry.execute('nonexistent', {} as any, {
        toolCallId: 'test',
        signal: undefined,
        onUpdate: undefined,
        ctx: {} as any,
        maxOutputSize: 1024 * 1024
      });
      expect(result.isError).toBe(true);
    });

    // Additional registry queries
    it('should list commands with metadata', async () => {
      // Execute a command to register it in executor
      const execResult = await registry.execute('system.info', {} as any, {
        toolCallId: 'init',
        signal: undefined,
        onUpdate: undefined,
        ctx: {} as any,
        maxOutputSize: 1024 * 1024
      });
      expect(execResult.isError).toBe(false);
      // Verify command appears in registry
      const names = registry.listCommands();
      expect(names).toContain('system.info');
      const list = registry.getCommandList();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      const systemInfo = list.find(c => c.name === 'system.info');
      expect(systemInfo).toBeDefined();
      expect(systemInfo.category).toBe('system');
      expect(systemInfo.description).toContain('system');
    });

    it('should categorize commands correctly', async () => {
      // Execute commands to register them
      const res1 = await registry.execute('system.info', {} as any, {
        toolCallId: '1', ctx: {} as any, signal: undefined, onUpdate: undefined, maxOutputSize: 1024*1024
      });
      expect(res1.isError).toBe(false);
      const res2 = await registry.execute('git.status', {} as any, {
        toolCallId: '2', ctx: {} as any, signal: undefined, onUpdate: undefined, maxOutputSize: 1024*1024
      });
      expect(res2.isError).toBe(false);
      const cats = registry.listCommandsByCategory();
      expect(cats.has('git')).toBe(true);
      expect(cats.get('git')).toContain('git.status');
      expect(cats.has('dev')).toBe(true);
      expect(cats.get('dev')).toContain('dev.test');
    });

    it('should generate help text for command', async () => {
      // Ensure command is loaded
      await registry.execute('system.info', {} as any, {
        toolCallId: 'h',
        signal: undefined,
        onUpdate: undefined,
        ctx: {} as any,
        maxOutputSize: 1024 * 1024
      });
      const help = registry.getCommandHelp('system.info');
      expect(help).toBeDefined();
      expect(help).toContain('Command: system.info');
      expect(help).toContain('Category: system');
      expect(help).toContain('Description:');
      expect(help).toContain('Examples:');
    });

    it('should return null help for unknown command', () => {
      const help = registry.getCommandHelp('unknown.command');
      expect(help).toBeNull();
    });
  });
});
