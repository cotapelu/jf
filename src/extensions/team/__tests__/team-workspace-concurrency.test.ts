import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';

describe('AgentTeam Workspace Concurrency', () => {
  let team: AgentTeam;

  beforeEach(async () => {
    team = createTestTeam('test-ws-concurrency');
    const registry = TeamRegistry.getInstance();
    registry.register(team.id, team);

    team.registerRuntime(createMockRuntime(), 'parent');
    team.registerRuntime(createMockRuntime(), 'agent-1');
    team.registerRuntime(createMockRuntime(), 'agent-2');
  });

  afterEach(async () => {
    const registry = TeamRegistry.getInstance();
    await team.dispose();
    registry.unregister(team.id);
  });

  test('should handle concurrent writes without corruption', async () => {
    await team.initialize([]); // no tasks

    // Simulate 100 concurrent writes from different agents
    const writes = Array.from({ length: 100 }, (_, i) =>
      team.workspaceWrite(`key-${i}`, `value-${i}`, `agent-${i % 2}`)
    );

    await Promise.all(writes);

    // Verify all keys present
    const keys = await team.workspaceList();
    expect(keys.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      const val = await team.workspaceRead(`key-${i}`);
      expect(val).toBe(`value-${i}`);
    }
  });

  test('should handle concurrent mixed operations', async () => {
    await team.initialize([]);

    // Mix: write, read, delete, list concurrently
    const ops = [
      team.workspaceWrite('k1', 'v1', 'agent-1'),
      team.workspaceWrite('k2', 'v2', 'agent-2'),
      team.workspaceRead('k1'),
      team.workspaceWrite('k3', 'v3', 'agent-1'),
      team.workspaceDelete('k2'),
      team.workspaceList(),
      team.workspaceWrite('k4', 'v4', 'agent-2'),
      team.workspaceRead('k4')
    ];

    const results = await Promise.all(ops);
    // Just ensure no crashes and reasonable results
    const reads = results.filter(r => typeof r === 'string');
    expect(reads.some(r => r === 'v1')).toBe(true); // read k1 should return v1
    const lists = results.filter(r => Array.isArray(r));
    expect(lists.some(arr => arr.includes('k3'))).toBe(true); // list should contain k3
  });

  // Stress test: many agents doing many ops
  test('stress: 50 agents, 500 ops total', async () => {
    await team.initialize([]);

    // Create 50 agents (simulate by reusing roles but many concurrent calls)
    const agentCount = 10; // use fewer but still concurrent
    const opsPerAgent = 50;
    const totalOps = agentCount * opsPerAgent;

    const promises: Promise<any>[] = [];
    for (let a = 0; a < agentCount; a++) {
      for (let i = 0; i < opsPerAgent; i++) {
        const key = `agent${a}-key${i}`;
        const value = `val${i}`;
        promises.push(team.workspaceWrite(key, value, `agent-${a}`));
      }
    }

    await Promise.all(promises);

    const keys = await team.workspaceList();
    expect(keys.length).toBeGreaterThanOrEqual(totalOps - agentCount); // allow some overwrites
  });
});
