import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute, metadata, schema } from '../commands/master_tool/stats.js';

// Mock getRegistry
vi.mock('../master-tool.js', async () => {
  const actual = await vi.importActual('../master-tool.js');
  return {
    ...actual,
    getRegistry: vi.fn()
  };
});

// Get reference to mocked getRegistry
const { getRegistry } = await import('../master-tool.js');

const mockRegistry = {
  getStats: vi.fn()
};

describe('master_tool.stats command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRegistry).mockReturnValue(mockRegistry as any);
  });

  describe('metadata', () => {
    it('has correct name and category', () => {
      expect(metadata.name).toBe('master_tool.stats');
      expect(metadata.category).toBe('master');
    });

    it('includes examples for all formats', () => {
      expect(metadata.examples).toContain('master_tool({ command: "master_tool.stats", args: {} })');
      expect(metadata.examples).toContain('master_tool({ command: "master_tool.stats", args: { format: "json" } })');
      expect(metadata.examples).toContain('master_tool({ command: "master_tool.stats", args: { format: "prometheus" } })');
    });
  });

  describe('schema', () => {
    it('accepts format enum values', () => {
      expect(schema.properties.format.enum).toEqual(['text', 'json', 'prometheus']);
      expect(schema.properties.format.default).toBe('text');
    });
  });

  describe('execute - text format (default)', () => {
    it('returns human-readable text output', async () => {
      mockRegistry.getStats.mockReturnValue({ registeredCommands: 5, totalExecutions: 123, successRate: 98.37, commandStats: [{ command: 'cmd1', count: 50, avgDuration: 10.5 }, { command: 'cmd2', count: 73, avgDuration: 15.2 }], cacheStats: { size: 3, hits: 100, misses: 20 }, recentErrors: [] });
      const result = await execute({}, '', undefined, undefined);
      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
      const out = result.stdout;
      const checks = ['📊 CommandExecutor Statistics','Registered commands: 5','Total executions: 123','Success rate: 98.37%','cmd1: 50 execs, avg 10.50ms','Cache: 3 entries, 100 hits, 20 misses'];
      checks.forEach(s => expect(out).toContain(s));
    });

    it('shows recent errors', async () => {
      mockRegistry.getStats.mockReturnValue({
        registeredCommands: 2,
        totalExecutions: 10,
        successRate: 90,
        commandStats: [],
        cacheStats: { size: 0, hits: 0, misses: 0 },
        recentErrors: [
          { command: 'bad_cmd', count: 3, error: 'Something failed' }
        ]
      });

      const result = await execute({}, '', undefined, undefined);
      expect(result.stdout).toContain('Recent Errors (top 10):');
      expect(result.stdout).toContain('bad_cmd: 3 errors – Something failed');
    });
  });

  describe('execute - json format', () => {
    it('returns JSON string of stats', async () => {
      const stats = {
        registeredCommands: 1,
        totalExecutions: 42,
        successRate: 100,
        commandStats: [{ command: 'x', count: 42, avgDuration: 1.23 }],
        cacheStats: { size: 1, hits: 41, misses: 1 },
        recentErrors: []
      };
      mockRegistry.getStats.mockReturnValue(stats);

      const result = await execute({ format: 'json' }, '', undefined, undefined);
      expect(result.code).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toEqual(stats);
    });
  });

  describe('execute - prometheus format', () => {
    it('returns Prometheus exposition format', async () => {
      mockRegistry.getStats.mockReturnValue({ registeredCommands: 3, totalExecutions: 1000, successRate: 99.5, commandStats: [{ command: 'master_tool.exec', count: 800, avgDuration: 5.25 }, { command: 'session.list', count: 200, avgDuration: 2.1 }], cacheStats: { size: 10, hits: 950, misses: 50 }, recentErrors: [{ command: 'bad', count: 5, error: 'Error: boom' }] });
      const result = await execute({ format: 'prometheus' }, '', undefined, undefined);
      expect(result.code).toBe(0);
      const lines = result.stdout.split('\n');
      const checks = ['# HELP jf_command_executions_total Total number of command executions','# TYPE jf_command_executions_total counter','jf_command_executions_total 1000','# HELP jf_command_errors_total Total number of command errors','# TYPE jf_command_errors_total counter','jf_command_errors_total{command="bad",error="Error: boom"} 5','# HELP jf_command_duration_seconds_total Total duration of command executions in seconds','# TYPE jf_command_duration_seconds_total counter','jf_command_duration_seconds_total{command="master_tool.exec"} 4.200000','jf_command_duration_seconds_total{command="session.list"} 0.420000','# HELP jf_command_cache_hits_total Number of cache hits','jf_command_cache_hits_total 950','# HELP jf_command_cache_misses_total Number of cache misses','jf_command_cache_misses_total 50','# HELP jf_command_registered_total Number of registered commands','# TYPE jf_command_registered_total gauge','jf_command_registered_total 3'];
      checks.forEach(s => expect(lines).toContain(s));
    });

    it('escapes quotes and backslashes in error messages', async () => {
      mockRegistry.getStats.mockReturnValue({
        registeredCommands: 1,
        totalExecutions: 0,
        successRate: 0,
        commandStats: [],
        cacheStats: { size: 0, hits: 0, misses: 0 },
        recentErrors: [
          { command: 'cmd', count: 1, error: 'Path: "C:\\Users\\test"' }
        ]
      });

      const result = await execute({ format: 'prometheus' }, '', undefined, undefined);
      expect(result.stdout).toContain('jf_command_errors_total{command="cmd",error="Path: C:/Users/test"} 1');
    });
  });

  describe('error handling', () => {
    it('returns error if registry not initialized', async () => {
      vi.mocked(getRegistry).mockReturnValue(null);
      const result = await execute({}, '', undefined, undefined);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Command registry not initialized');
    });

    it('handles unexpected exception', async () => {
      mockRegistry.getStats.mockImplementation(() => {
        throw new Error('DB failure');
      });
      const result = await execute({ format: 'json' }, '', undefined, undefined);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Error retrieving stats: DB failure');
    });
  });
});
