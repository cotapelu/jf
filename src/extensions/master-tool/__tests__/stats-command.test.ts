import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute, metadata } from '../commands/master_tool/stats.js';

// Mock the master-tool module which provides getRegistry
vi.mock('../master-tool.js', () => ({
  getRegistry: vi.fn()
}));

import { getRegistry } from '../master-tool.js';

describe('master_tool.stats command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return formatted stats', async () => {
    const fakeRegistry = { getStats: () => ({ registeredCommands: 2, totalExecutions: 42, successRate: 95.5, commandStats: [{ command: 'git.status', count: 20, avgDuration: 45.123 }, { command: 'dev.test', count: 22, avgDuration: 120.567 }], cacheStats: { size: 10, hits: 100, misses: 20 }, recentErrors: [{ command: 'bad.cmd', error: 'boom', count: 3 }] }) };
    (getRegistry as any).mockReturnValue(fakeRegistry);
    const result = await execute({}, '/tmp', undefined, {} as any);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    const out = result.stdout;
    const checks = ['Registered commands: 2','Total executions: 42','Success rate: 95.5%','git.status: 20 execs, avg 45.12ms','dev.test: 22 execs, avg 120.57ms','Cache: 10 entries, 100 hits, 20 misses','bad.cmd: 3 errors – boom'];
    checks.forEach(s => expect(out).toContain(s));
  });

  it('handles empty stats gracefully', async () => {
    const fakeRegistry = {
      getStats: () => ({
        registeredCommands: 0,
        totalExecutions: 0,
        successRate: 0,
        commandStats: [],
        cacheStats: { size: 0, hits: 0, misses: 0 },
        recentErrors: []
      })
    };
    (getRegistry as any).mockReturnValue(fakeRegistry);

    const result = await execute({}, '/tmp', undefined, {} as any);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Registered commands: 0');
    expect(result.stdout).toContain('Recent Errors (top 10):\n  (none)');
  });

  it('handles registry unavailable', async () => {
    (getRegistry as any).mockReturnValue(null);

    const result = await execute({}, '/tmp', undefined, {} as any);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Command registry not initialized');
  });

  it('should output JSON when format=json', async () => {
    const fakeRegistry = { getStats: () => ({ registeredCommands: 1, totalExecutions: 10, successRate: 100, commandStats: [{ command: 'test.cmd', count: 10, avgDuration: 50 }], cacheStats: { size: 1, hits: 10, misses: 0 }, recentErrors: [] }) };
    (getRegistry as any).mockReturnValue(fakeRegistry);
    const result = await execute({ format: 'json' }, '/tmp', undefined, {} as any);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    const parsed = JSON.parse(result.stdout);
    expect(parsed.registeredCommands).toBe(1);
    expect(parsed.totalExecutions).toBe(10);
    expect(parsed.successRate).toBe(100);
    expect(parsed.commandStats).toHaveLength(1);
    expect(parsed.commandStats[0].command).toBe('test.cmd');
  });

  it('should output Prometheus format when format=prometheus', async () => {
    const fakeRegistry = { getStats: () => ({ registeredCommands: 2, totalExecutions: 100, successRate: 99.0, commandStats: [{ command: 'git.status', count: 50, avgDuration: 30.5 }, { command: 'dev.test', count: 50, avgDuration: 120.5 }], cacheStats: { size: 5, hits: 80, misses: 20 }, recentErrors: [{ command: 'bad.cmd', error: 'boom', count: 3 }] }) };
    (getRegistry as any).mockReturnValue(fakeRegistry);
    const result = await execute({ format: 'prometheus' }, '/tmp', undefined, {} as any);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    const out = result.stdout;
    const checks = ['# HELP jf_command_executions_total','jf_command_executions_total 100','# HELP jf_command_errors_total','jf_command_errors_total{command="bad.cmd",error="boom"} 3','# TYPE jf_command_duration_seconds_total counter','# HELP jf_command_cache_hits_total','jf_command_cache_hits_total 80','jf_command_registered_total 2','jf_command_duration_seconds_total{command="git.status"}'];
    checks.forEach(s => expect(out).toContain(s));
    // Also verify the duration metric value is numeric
    expect(out).toMatch(/jf_command_duration_seconds_total\{command="git\.status"\} [0-9.]+/);
  });

  it('handles exception from getStats', async () => {
    (getRegistry as any).mockReturnValue({
      getStats: () => { throw new Error('DB failure'); }
    });

    const result = await execute({}, '/tmp', undefined, {} as any);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Error retrieving stats');
    expect(result.data?.error).toBe('stats_failed');
  });
});
