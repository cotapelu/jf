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
    const fakeRegistry = {
      getStats: () => ({
        registeredCommands: 2,
        totalExecutions: 42,
        successRate: 95.5,
        commandStats: [
          { command: 'git.status', count: 20, avgDuration: 45.123 },
          { command: 'dev.test', count: 22, avgDuration: 120.567 }
        ],
        cacheStats: { size: 10, hits: 100, misses: 20 },
        recentErrors: [
          { command: 'bad.cmd', error: 'boom', count: 3 }
        ]
      })
    };
    (getRegistry as any).mockReturnValue(fakeRegistry);

    const result = await execute({}, '/tmp', undefined, {} as any);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    const out = result.stdout;
    expect(out).toContain('Registered commands: 2');
    expect(out).toContain('Total executions: 42');
    expect(out).toContain('Success rate: 95.5%');
    expect(out).toContain('git.status: 20 execs, avg 45.12ms');
    expect(out).toContain('dev.test: 22 execs, avg 120.57ms');
    expect(out).toContain('Cache: 10 entries, 100 hits, 20 misses');
    expect(out).toContain('bad.cmd: 3 errors – boom');
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
});
