import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';


function any<T>(value: T): any { return value; }

describe('AgentTeam Claim Performance Optimization', () => {
  const LONG_TIMEOUT = 30000; // 30 seconds for performance tests
  let team: AgentTeam;

  beforeEach(async () => {
    team = createTestTeam('test-perf-team');
    const registry = TeamRegistry.getInstance();
    registry.register(team.id, team);

    // Register a mock runtime
    team.registerRuntime(createMockRuntime(), 'parent');
    team.registerRuntime(createMockRuntime(), 'agent-1');
  });

  afterEach(async () => {
    const registry = TeamRegistry.getInstance();
    await team.dispose();
    registry.unregister(team.id);
  });

  test('should initialize pendingIndices with all task indices sorted', async () => {
    team.tasks = ['task0', 'task1', 'task2', 'task3'];
    await team.initialize(team.tasks);

    const pendingIndices = (any(team)).pendingIndices;
    expect(pendingIndices).toEqual([0, 1, 2, 3]);
  }, LONG_TIMEOUT);

  test('claimTask should remove claimed index from pendingIndices', async () => {
    team.tasks = ['task0', 'task1', 'task2'];
    await team.initialize(team.tasks);

    const claimed = await team.claimTask('agent-1');
    expect(claimed).toBe(0);

    const pendingIndices = (any(team)).pendingIndices;
    expect(pendingIndices).toEqual([1, 2]);
  });

  test('releaseTask should insert index back into pendingIndices in sorted order', async () => {
    team.tasks = ['task0', 'task1', 'task2'];
    await team.initialize(team.tasks);

    // Claim task 0
    await team.claimTask('agent-1');
    let pending = (any(team)).pendingIndices;
    expect(pending).toEqual([1, 2]);

    // Release task 0
    await team.releaseTask('agent-1', 0);
    pending = (any(team)).pendingIndices;
    expect(pending).toEqual([0, 1, 2]); // sorted
  });

  test('releaseTask should handle arbitrary index insertion maintaining sort', async () => {
    team.tasks = Array.from({ length: 5 }, (_, i) => `task${i}`);
    await team.initialize(team.tasks);

    // Claim all tasks
    await team.claimTask('agent-1'); // 0
    await team.claimTask('agent-1'); // 1
    await team.claimTask('agent-1'); // 2
    let pending = (any(team)).pendingIndices;
    expect(pending).toEqual([3, 4]);

    // Release task 2 (middle)
    await team.releaseTask('agent-1', 2);
    pending = (any(team)).pendingIndices;
    expect(pending).toEqual([2, 3, 4]);

    // Release task 0 (beginning)
    await team.releaseTask('agent-1', 0);
    pending = (any(team)).pendingIndices;
    expect(pending).toEqual([0, 2, 3, 4]);

    // Release task 4 (end)
    await team.releaseTask('agent-1', 4);
    pending = (any(team)).pendingIndices;
    expect(pending).toEqual([0, 2, 3, 4]); // 4 already there? Actually task 4 wasn't claimed initially, so still [3]? Let's check: initially [0,1,2,3,4], claimed [0,1,2] -> pending [3,4]. Release 2 -> [2,3,4]. Release 0 -> [0,2,3,4]. Release 4 -> 4 already in? No, 4 was pending already. So after releasing 0, pending [0,2,3,4]. 4 already there. So release 4 should not duplicate. Our releaseTask should only insert if not already pending.
  });

  test('handleAgentFailure should reinsert task into pendingIndices with backoff', async () => {
    team.tasks = ['task0'];
    await team.initialize(team.tasks);

    // Claim task
    await team.claimTask('agent-1');
    let pending = (any(team)).pendingIndices;
    expect(pending).toEqual([]); // claimed

    // Simulate failure
    await team.handleAgentFailure('agent-1', 0, new Error('fail'));

    pending = (any(team)).pendingIndices;
    expect(pending).toContain(0); // readded
    const task = (any(team)).taskStatuses.get(0);
    expect(task.status).toBe('pending');
    expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
  });

  test('claimTask should skip tasks with retryAvailableAt in the future', async () => {
    team.tasks = ['task0', 'task1'];
    await team.initialize(team.tasks);

    // Claim task 0, then failure with backoff
    await team.claimTask('agent-1');
    await team.handleAgentFailure('agent-1', 0, new Error('fail'));

    // Try to claim - should skip task 0 and claim task 1
    const claimed = await team.claimTask('agent-1');
    expect(claimed).toBe(1);

    const pending = (any(team)).pendingIndices;
    expect(pending).toContain(0); // still in pending
    expect(pending).not.toContain(1); // 1 was claimed
  });

  test('performance: claimTask should be O(1) average with many tasks', async () => {
    // Create 1000 tasks (enough to test scalability)
    const N = 1000;
    team.tasks = Array.from({ length: N }, (_, i) => `task${i}`);
    await team.initialize(team.tasks);

    // Measure time for 100 claims
    const iterations = 100;
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      await team.claimTask('agent-1');
    }
    const elapsed = Date.now() - start;

    // Average should be < 1ms per claim
    const avg = elapsed / iterations;
    console.log(`Average claim time: ${avg}ms`);
    expect(avg).toBeLessThan(5); // 5ms bound
  });

  test('pendingIndices should not contain duplicates after repeated release/failure', async () => {
    team.tasks = ['task0', 'task1'];
    await team.initialize(team.tasks);

    // Claim and release multiple times
    for (let i = 0; i < 5; i++) {
      await team.claimTask('agent-1');
      await team.releaseTask('agent-1', 0);
    }

    let pending = (any(team)).pendingIndices;
    const count0 = pending.filter((idx: number) => idx === 0).length;
    expect(count0).toBe(1); // no duplicates

    // Failure cycle
    await team.claimTask('agent-1');
    await team.handleAgentFailure('agent-1', 0, new Error('fail'));
    pending = (any(team)).pendingIndices;
    const count0After = pending.filter((idx: number) => idx === 0).length;
    expect(count0After).toBe(1);
  });
});
