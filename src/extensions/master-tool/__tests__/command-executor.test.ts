import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CommandExecutor } from '../command-executor.js';
import type { CommandModule, CommandMetadata, CommandRegistryEntry, ExecutionContext, CommandResult } from '../types/command-module.js';
import { CommandValidator } from '../utils/command-validator.js';
import { StateManager } from '../state-manager.js';

// Mock dependencies
vi.mock('./utils/command-cache.js', () => ({
  CommandCache: class {
    private map = new Map<string, any>();
    get(key: string) { return this.map.get(key) || null; }
    set(key: string, value: any, meta: any) { this.map.set(key, value); }
    markError(key: string, error: string) {}
    getStats() { return { size: this.map.size, hits: 0, misses: 0 }; }
  }
}));

vi.mock('./utils/command-validator.js', () => {
  class MockCommandValidator {
    checkRateLimit(command: string) { return { allowed: true, resetIn: 0 }; }
    validateWithSchema(args: any, schema: any, command: string) { return { valid: true, errors: null }; }
    validateSecurity(args: any, metadata: CommandMetadata) { return { valid: true, errors: [] }; }
    validateResult(result: CommandResult, maxSize: number) { return { valid: true, errors: [] }; }
  }
  return {
    CommandValidator: MockCommandValidator,
    getValidator: () => new MockCommandValidator()
  };
});

vi.mock('./state-manager.js', () => ({
  StateManager: class {
    private states = new Map<string, any>();
    getOrCreateState(cmd: string, ctx: any, StateClass: any, getPath?: any) {
      let state = this.states.get(cmd);
      if (!state) {
        state = { data: {}, mutex: { lock: vi.fn().mockResolvedValue(() => {}) }, isDirty: false };
        this.states.set(cmd, state);
      }
      return state;
    }
    hasState(cmd: string, ctx: any) { return this.states.has(cmd); }
    restoreState(cmd: string, ctx: any, StateClass: any, getPath?: any) { return Promise.resolve(); }
    saveStateIfDirty(cmd: string, ctx: any) { return Promise.resolve(); }
  }
}));

// Helpers
function createMockCommandModule(overrides: Partial<CommandModule> = {}): CommandModule {
  return {
    metadata: {
      name: 'test.cmd',
      category: 'test',
      description: 'Test command',
      ...overrides.metadata
    },
    schema: overrides.schema ?? {},
    execute: overrides.execute ?? vi.fn().mockResolvedValue({ code: 0, stdout: 'OK', stderr: '' }),
    StateClass: overrides.StateClass,
    getPersistencePath: overrides.getPersistencePath,
    beforeExecute: overrides.beforeExecute,
    afterExecute: overrides.afterExecute,
    ...overrides
  };
}

function createEntry(module: CommandModule): CommandRegistryEntry {
  return {
    metadata: module.metadata,
    schema: module.schema,
    loader: vi.fn().mockResolvedValue(module),
    module: undefined,
    StateClass: module.StateClass,
    getPersistencePath: module.getPersistencePath,
    errorCount: 0,
    lastError: null,
    lastLoaded: 0,
    loadCount: 0
  };
}

const defaultExecCtx: ExecutionContext = {
  toolCallId: 'call-123',
  signal: undefined,
  onUpdate: undefined,
  ctx: { cwd: '/tmp' },
  maxOutputSize: 1024 * 1024
};

describe('CommandExecutor', () => {
  let executor: CommandExecutor;
  let mockEntry: CommandRegistryEntry;
  let mockModule: CommandModule;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModule = createMockCommandModule();
    mockEntry = createEntry(mockModule);
    executor = new CommandExecutor({ enableAudit: false });
    executor['register'](mockEntry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register()', () => {
    it('should register command', () => {
      expect(executor.listCommands()).toContain('test.cmd');
    });

    it('should exclude commands by name', () => {
      executor = new CommandExecutor({ excludeCommands: ['test.cmd'] });
      executor['register'](mockEntry);
      expect(executor.listCommands()).not.toContain('test.cmd');
    });

    it('should exclude commands by category', () => {
      executor = new CommandExecutor({ excludeCategories: ['test'] });
      executor['register'](mockEntry);
      expect(executor.listCommands()).not.toContain('test.cmd');
    });
  });

  describe('unregister()', () => {
    it('should unregister command', () => {
      const result = executor.unregister('test.cmd');
      expect(result).toBe(true);
      expect(executor.listCommands()).not.toContain('test.cmd');
    });

    it('should return false for unknown command', () => {
      const result = executor.unregister('unknown');
      expect(result).toBe(false);
    });
  });

  describe('listCommandsByCategory()', () => {
    it('should group commands by category sorted', () => {
      const map = executor.listCommandsByCategory();
      expect(map.get('test')).toEqual(['test.cmd']);
    });
  });

  describe('getMetadata() and getSchema()', () => {
    it('should return metadata', () => {
      expect(executor.getMetadata('test.cmd')).toEqual(mockModule.metadata);
    });

    it('should return schema', () => {
      expect(executor.getSchema('test.cmd')).toEqual({});
    });
  });

  describe('execute()', () => {
    it('should return error when command not found', async () => {
      const result = await executor.execute('unknown', {}, defaultExecCtx);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Command not found');
    });

    it('should handle rate limit exceeded', async () => {
      vi.spyOn(CommandValidator.prototype, 'checkRateLimit').mockReturnValue({ allowed: false, resetIn: 30 });
      const result = await executor.execute('test.cmd', {}, defaultExecCtx);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Rate limit exceeded');
    });

    it('should handle schema validation failure', async () => {
      vi.spyOn(CommandValidator.prototype, 'validateWithSchema').mockReturnValue({ valid: false, errors: [{ path: ['arg'], message: 'required' }] });
      const result = await executor.execute('test.cmd', {}, defaultExecCtx);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Validation failed');
    });

    it('should handle security validation failure', async () => {
      vi.spyOn(CommandValidator.prototype, 'validateSecurity').mockReturnValue({ valid: false, errors: ['sensitive'] });
      const result = await executor.execute('test.cmd', {}, defaultExecCtx);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Security');
    });

    it('should execute successfully without state', async () => {
      const result = await executor.execute('test.cmd', {}, defaultExecCtx);
      expect(result.code).toBe(0);
      expect(result.stdout).toBe('OK');
    });

    it('should call beforeExecute and afterExecute hooks', async () => {
      const before = vi.fn().mockResolvedValue(undefined);
      const after = vi.fn().mockResolvedValue(undefined);
      const mod = createMockCommandModule({
        beforeExecute: before,
        afterExecute: after
      });
      const entry = createEntry(mod);
      executor['register'](entry);

      await executor.execute('test.cmd', {}, defaultExecCtx);

      expect(before).toHaveBeenCalledWith({}, expect.any(Object));
      expect(after).toHaveBeenCalledWith({ code: 0, stdout: 'OK', stderr: '' }, expect.any(Object));
    });

    it('should handle afterExecute failure gracefully', async () => {
      const after = vi.fn().mockRejectedValue(new Error('hook fail'));
      const mod = createMockCommandModule({ afterExecute: after });
      const entry = createEntry(mod);
      executor['register'](entry);

      const result = await executor.execute('test.cmd', {}, defaultExecCtx);

      expect(result.code).toBe(0); // still success
    });

    it('should handle command execution error', async () => {
      const mod = createMockCommandModule({
        execute: vi.fn().mockRejectedValue(new Error('exec failed'))
      });
      const entry = createEntry(mod);
      executor['register'](entry);

      const result = await executor.execute('test.cmd', {}, defaultExecCtx);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('exec failed');
    });

    describe('stateful command', () => {
      it('should acquire mutex, execute, and release', async () => {
        const releaseMock = vi.fn();
        const mockMutex = { lock: vi.fn().mockResolvedValue(releaseMock) };
        const customState = { data: {}, mutex: mockMutex, isDirty: false };
        vi.spyOn(StateManager.prototype, 'getOrCreateState').mockReturnValue(customState);
        const mod = createMockCommandModule({ StateClass: class {} });
        const entry = createEntry(mod);
        executor['register'](entry);

        await executor.execute('test.cmd', {}, defaultExecCtx);

        expect(mockMutex.lock).toHaveBeenCalled();
        expect(releaseMock).toHaveBeenCalled();
      });

      it('should restore state if not present', async () => {
        const hasStateSpy = vi.spyOn(StateManager.prototype, 'hasState').mockReturnValue(false);
        const restoreSpy = vi.spyOn(StateManager.prototype, 'restoreState').mockResolvedValue(undefined);
        const mod = createMockCommandModule({ StateClass: class {} });
        const entry = createEntry(mod);
        executor['register'](entry);

        await executor.execute('test.cmd', {}, defaultExecCtx);

        expect(restoreSpy).toHaveBeenCalled();
        hasStateSpy.mockRestore();
        restoreSpy.mockRestore();
      });

      it('should skip restore if state exists', async () => {
        const hasStateSpy = vi.spyOn(StateManager.prototype, 'hasState').mockReturnValue(true);
        const restoreSpy = vi.spyOn(StateManager.prototype, 'restoreState');
        const mod = createMockCommandModule({ StateClass: class {} });
        const entry = createEntry(mod);
        executor['register'](entry);

        await executor.execute('test.cmd', {}, defaultExecCtx);

        expect(restoreSpy).not.toHaveBeenCalled();
        hasStateSpy.mockRestore();
        restoreSpy.mockRestore();
      });

      it('should save state if dirty', async () => {
        const dirtyState = { data: {}, mutex: { lock: vi.fn().mockResolvedValue(() => {}) }, isDirty: true };
        vi.spyOn(StateManager.prototype, 'getOrCreateState').mockReturnValue(dirtyState);
        const saveSpy = vi.spyOn(StateManager.prototype, 'saveStateIfDirty').mockResolvedValue(undefined);
        const mod = createMockCommandModule({ StateClass: class {} });
        const entry = createEntry(mod);
        executor['register'](entry);

        await executor.execute('test.cmd', {}, defaultExecCtx);

        expect(saveSpy).toHaveBeenCalled();
        saveSpy.mockRestore();
      });
    });

    describe('output validation', () => {
      it('should truncate stdout if exceeds max size', async () => {
        const huge = 'a'.repeat(2 * 1024 * 1024);
        const mod = createMockCommandModule({
          execute: vi.fn().mockResolvedValue({ code: 0, stdout: huge, stderr: '' })
        });
        const entry = createEntry(mod);
        executor['register'](entry);
        vi.spyOn(CommandValidator.prototype, 'validateResult').mockReturnValue({ valid: false, errors: ['output too large'] });
        const result = await executor.execute('test.cmd', {}, { ...defaultExecCtx, maxOutputSize: 100 });
        // Truncation adds a notice so total length > max
        expect(result.stdout!.length).toBeLessThan(huge.length);
        expect(result.stdout).toContain('... (truncated)');
      });

      it('should add warning if validation fails', async () => {
        vi.spyOn(CommandValidator.prototype, 'validateResult').mockReturnValue({ valid: false, errors: ['output too large'] });
        const result = await executor.execute('test.cmd', {}, defaultExecCtx);
        expect(result.stderr).toContain('Warning: output too large');
      });
    });

    describe('audit logging', () => {
      it('should log when enabled', async () => {
        executor = new CommandExecutor({ enableAudit: true });
        executor['register'](mockEntry);
        const logSpy = vi.spyOn(executor as any, 'logAudit');
        await executor.execute('test.cmd', {}, defaultExecCtx);
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            toolCallId: 'call-123',
            command: 'test.cmd',
            success: true,
            durationMs: expect.any(Number)
          })
        );
      });

      it('should log failures', async () => {
        executor = new CommandExecutor({ enableAudit: true });
        executor['register'](mockEntry);
        vi.mocked(mockModule.execute).mockRejectedValue(new Error('fail'));
        const logSpy = vi.spyOn(executor as any, 'logAudit');
        await executor.execute('test.cmd', {}, defaultExecCtx);
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('fail')
          })
        );
      });
    });

    describe('loadModule()', () => {
      it('should load from cache', async () => {
        const mockCache = { get: vi.fn().mockReturnValue(mockModule), set: vi.fn(), markError: vi.fn() };
        (executor as any).cache = mockCache;
        const module = await executor['loadModule']('test.cmd', mockEntry);
        expect(mockCache.get).toHaveBeenCalledWith('test.cmd');
        expect(mockEntry.loader).not.toHaveBeenCalled();
        expect(module).toBe(mockModule);
      });

      it('should dynamic import and cache', async () => {
        const mockCache = { get: vi.fn().mockReturnValue(null), set: vi.fn(), markError: vi.fn() };
        (executor as any).cache = mockCache;
        const module = await executor['loadModule']('test.cmd', mockEntry);
        expect(mockEntry.loader).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith('test.cmd', module, mockModule.metadata);
        expect(mockEntry.module).toBe(module);
      });

      it('should handle load failure', async () => {
        mockEntry.loader = vi.fn().mockRejectedValue(new Error('load failed'));
        await expect(executor['loadModule']('test.cmd', mockEntry)).rejects.toThrow('Failed to load command');
      });
    });

    describe('getStats()', () => {
      it('should return stats', () => {
        (executor as any).auditLogs.push({
          timestamp: Date.now(),
          toolCallId: 'c1',
          command: 'test.cmd',
          success: true,
          durationMs: 10,
          argsSize: 10,
          outputSize: 5
        } as any);
        const stats = executor.getStats();
        expect(stats.registeredCommands).toBe(1);
        expect(stats.totalExecutions).toBe(1);
        expect(stats.successRate).toBe(100);
        expect(stats.recentErrors).toEqual([]);
      });

      it('should group errors by command', () => {
        const now = Date.now();
        (executor as any).auditLogs.push({
          timestamp: now,
          toolCallId: 'c1',
          command: 'test.cmd',
          success: false,
          error: 'boom',
          argsSize: 0,
          outputSize: 0
        } as any);
        (executor as any).auditLogs.push({
          timestamp: now,
          toolCallId: 'c2',
          command: 'test.cmd',
          success: false,
          error: 'boom',
          argsSize: 0,
          outputSize: 0
        } as any);
        const stats = executor.getStats();
        expect(stats.recentErrors).toHaveLength(1);
        expect(stats.recentErrors[0]).toEqual({ command: 'test.cmd', error: 'boom', count: 2 });
      });
    });

    describe('clearAuditLogs()', () => {
      it('should clear audit logs', () => {
        (executor as any).auditLogs.push({} as any);
        executor.clearAuditLogs();
        expect(executor.getStats().totalExecutions).toBe(0);
      });
    });

    describe('command execution stats (observability)', () => {
      it('should accumulate count and average duration for successful commands', async () => {
        const newExecutor = new CommandExecutor();
        newExecutor['register'](mockEntry);
        const mockExecute = vi.fn().mockResolvedValue({ code: 0, stdout: 'OK', stderr: '' });
        mockModule.execute = mockExecute;

        await newExecutor.execute('test.cmd', {}, defaultExecCtx);
        await newExecutor.execute('test.cmd', {}, defaultExecCtx);

        const stats = newExecutor.getStats();
        const cmdStat = stats.commandStats.find((cs: any) => cs.command === 'test.cmd');
        expect(cmdStat).toBeDefined();
        expect(cmdStat.count).toBe(2);
        expect(cmdStat.avgDuration).toBeGreaterThanOrEqual(0);
      });

      it('should include failed executions in stats', async () => {
        const newExecutor = new CommandExecutor();
        newExecutor['register'](mockEntry);
        // Simulate failure
        vi.mocked(mockModule.execute).mockRejectedValue(new Error('exec failed'));

        const result = await newExecutor.execute('test.cmd', {}, defaultExecCtx);
        expect(result.code).toBe(1);

        const stats = newExecutor.getStats();
        const cmdStat = stats.commandStats.find((cs: any) => cs.command === 'test.cmd');
        expect(cmdStat).toBeDefined();
        expect(cmdStat.count).toBe(1);
      });
    });
  });
});
