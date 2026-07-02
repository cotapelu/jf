import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandExecutor } from '../command-executor.js';
import type { CommandRegistryEntry, CommandModule } from '../types/command-module.js';

function makeEntry(module: CommandModule, overrides: Partial<CommandRegistryEntry> = {}): CommandRegistryEntry {
  const entry: CommandRegistryEntry = {
    loader: () => Promise.resolve(module),
    metadata: module.metadata,
    schema: module.schema,
    StateClass: module.StateClass,
    getPersistencePath: module.getPersistencePath,
    lastLoaded: Date.now(),
    loadCount: 0,
    errorCount: 0,
    ...overrides
  };
  return entry;
}

describe('CommandExecutor Remaining Coverage', () => {
  let executor: CommandExecutor;
  let execCtx: any;
  let stateManagerMock: any;

  const baseOptions = {
    enableAudit: true
  };

  beforeEach(() => {
    stateManagerMock = {
      getOrCreateState: vi.fn().mockImplementation((cmd: string, ctx: any, StateClass: any) => {
        if (StateClass) {
          return new StateClass();
        }
        return { isDirty: false, mutex: undefined, markDirty: vi.fn() };
      }),
      hasState: vi.fn().mockReturnValue(true),
      restoreState: vi.fn().mockResolvedValue(false),
      saveStateIfDirty: vi.fn().mockResolvedValue(undefined)
    };

    executor = new CommandExecutor(baseOptions as any);
    (executor as any).stateManager = stateManagerMock;

    execCtx = {
      toolCallId: 'tid-1',
      signal: undefined,
      onUpdate: undefined,
      ctx: {},
      maxOutputSize: 100
    };
  });

  describe('afterExecute hook error handling', () => {
    it('should catch and log afterExecute errors without affecting result', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mod = {
        metadata: { name: 'cmd', category: 'test', description: 'Test' },
        schema: { type: 'object', properties: {} },
        execute: async () => ({ code: 0, stdout: 'done' }),
        afterExecute: async () => { throw new Error('after fail'); }
      };
      (executor as any).registry.set('cmd', makeEntry(mod));
      const result = await executor.execute('cmd', {}, execCtx);
      expect(result.code).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('afterExecute hook failed'), expect.anything());
      consoleSpy.mockRestore();
    });
  });

  describe('Auto-save dirty state', () => {
    it('should call saveStateIfDirty when state is dirty and StateClass exists', async () => {
      class TestState {
        isDirty = false;
        markDirty() { this.isDirty = true; }
      }
      const mod = {
        metadata: { name: 'cmd', category: 'test', description: 'Test' },
        schema: { type: 'object', properties: {} },
        StateClass: TestState,
        execute: async (args: any, cwd: string, signal: any, ctx: any) => {
          ctx.commandState.isDirty = true;
          ctx.commandState.markDirty();
          return { code: 0, stdout: 'ok' };
        }
      };
      (executor as any).registry.set('cmd', makeEntry(mod));
      await executor.execute('cmd', {}, execCtx);
      expect(stateManagerMock.saveStateIfDirty).toHaveBeenCalledWith('cmd', expect.anything());
    });
  });

  describe('Output validation truncation', () => {
    it('should truncate stdout exceeding maxOutputSize', async () => {
      const longStr = 'x'.repeat(200);
      const mod = {
        metadata: { name: 'cmd', category: 'test', description: 'Test' },
        schema: { type: 'object', properties: {} },
        execute: async () => ({ code: 0, stdout: longStr, stderr: '' })
      };
      (executor as any).registry.set('cmd', makeEntry(mod));
      const result = await executor.execute('cmd', {}, execCtx);
      // Truncated string includes the truncation marker, so length will be > max
      expect(result.stdout?.startsWith(longStr.slice(0, 100))).toBe(true);
      expect(result.stdout).toContain('... (truncated)');
      expect(result.stderr).toContain('Warning');
    });

    it('should truncate stderr exceeding maxOutputSize', async () => {
      const longStr = 'y'.repeat(200);
      const mod = {
        metadata: { name: 'cmd', category: 'test', description: 'Test' },
        schema: { type: 'object', properties: {} },
        execute: async () => ({ code: 0, stdout: '', stderr: longStr })
      };
      (executor as any).registry.set('cmd', makeEntry(mod));
      const result = await executor.execute('cmd', {}, execCtx);
      expect(result.stderr?.startsWith(longStr.slice(0, 100))).toBe(true);
      expect(result.stderr).toContain('... (truncated)');
    });
  });

  describe('getStats', () => {
    it('should compute correct statistics with mixed logs', () => {
      const now = Date.now();
      const logs = [
        { timestamp: now - 10000, success: true, error: undefined },
        { timestamp: now - 5000, success: false, error: 'oops', command: 'failCmd' },
        { timestamp: now - 2000, success: false, error: 'err2', command: 'failCmd' },
        { timestamp: now, success: true, error: undefined }
      ];
      (executor as any).auditLogs = logs;
      const stats = executor.getStats();
      expect(stats.totalExecutions).toBe(4);
      expect(stats.successRate).toBe(50);
      expect(stats.recentErrors).toHaveLength(1);
      expect(stats.recentErrors[0].command).toBe('failCmd');
      expect(stats.recentErrors[0].count).toBe(2);
    });
  });

  describe('getAuditLogs', () => {
    it('should filter logs by since timestamp', () => {
      const now = Date.now();
      const logs = [
        { timestamp: now - 2000, success: true },
        { timestamp: now - 1000, success: false },
        { timestamp: now, success: true }
      ];
      (executor as any).auditLogs = logs;
      const filtered = executor.getAuditLogs(now - 1500);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].timestamp).toBe(now - 1000);
    });

    it('should return all logs when since not provided', () => {
      const logs = [{ timestamp: 1 }, { timestamp: 2 }];
      (executor as any).auditLogs = logs;
      expect(executor.getAuditLogs()).toHaveLength(2);
    });
  });

  describe('clearAuditLogs', () => {
    it('should clear all audit logs', () => {
      (executor as any).auditLogs = [{}, {}, {}];
      executor.clearAuditLogs();
      expect((executor as any).auditLogs).toHaveLength(0);
    });
  });

  describe('logAudit rotation', () => {
    it('should keep only last 1000 logs', () => {
      const logEntry = {
        timestamp: Date.now(),
        toolCallId: '',
        command: 'cmd',
        success: true,
        durationMs: 10,
        argsSize: 10,
        outputSize: 10
      };
      for (let i = 0; i < 1000; i++) {
        logEntry.toolCallId = `tid-${i}`;
        (executor as any)['logAudit'](logEntry as any);
      }
      expect((executor as any).auditLogs.length).toBe(1000);
      // Add one more to trigger rotation
      logEntry.toolCallId = 'overflow';
      (executor as any)['logAudit'](logEntry as any);
      expect((executor as any).auditLogs.length).toBe(1000);
      expect((executor as any).auditLogs[999].toolCallId).toBe('overflow');
    });
  });

  describe('Error path audit in catch', () => {
    it('should log audit when execution throws and enableAudit true', async () => {
      const mod = {
        metadata: { name: 'cmd', category: 'test', description: 'Test' },
        schema: { type: 'object', properties: {} },
        execute: async () => { throw new Error('exec failure'); }
      };
      (executor as any).registry.set('cmd', makeEntry(mod));
      const result = await executor.execute('cmd', {}, execCtx);
      expect(result.code).toBe(1);
      const logs = (executor as any).auditLogs;
      expect(logs.some(l => !l.success && l.toolCallId === 'tid-1')).toBe(true);
    });
  });
});
