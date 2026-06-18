/**
 * Concurrency test for AgentTeam task assignment.
 *
 * Verifies that concurrent claimTask calls do not assign same task to multiple agents.
 * Runs multiple iterations to increase chance of detecting race conditions.
 */

import { AgentTeam } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';
import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest';

describe('AgentTeam Concurrency', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.registerRuntime(createMockRuntime(), 'parent');
  });

  afterEach(async () => {
    if (team) {
      await team.dispose();
    }
  });

  test('should assign unique tasks under high concurrency', async () => {
    const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4'];
    const tasks = ['t0', 't1', 't2', 't3']; // 4 tasks for 4 agents

    agents.forEach(a => team.registerRuntime(createMockRuntime(), a));
    await team.initialize(tasks);

    // Run many iterations to expose race condition
    for (let iter = 0; iter < 100; iter++) {
      // Reset state for each iteration (re-initialize to clear assignments)
      await team.initialize(tasks);

      // Concurrent claim
      const claimPromises = agents.map(agent => team.claimTask(agent));
      const results = await Promise.all(claimPromises);

      // All agents should get a task (non-null)
      const assigned = results.filter(r => r !== null);
      expect(assigned).toHaveLength(agents.length);

      // All assigned indices must be unique
      const uniqueIndices = new Set(results);
      expect(uniqueIndices.size).toBe(agents.length);

      // Complete tasks to free up
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const taskIdx = results[i];
        if (taskIdx !== null) {
          await team.completeTask(agent, taskIdx, `result`);
        }
      }
    }
  }, 20000);

  test('should handle mixed claim/complete concurrently', async () => {
    const agents = ['a1', 'a2', 'a3'];
    await team.initialize(['t0', 't1', 't2', 't3', 't4']); // 5 tasks, 3 agents

    // Agents will race to claim tasks in multiple rounds
    const rounds = 3;
    for (let round = 0; round < rounds; round++) {
      // Determine available agents
      const availableAgents = agents.filter(a => team.getMyCurrentTask(a) === null);
      if (availableAgents.length === 0) break;

      const claims = await Promise.all(
        availableAgents.map(a => team.claimTask(a))
      );

      // Some agents might get null if no tasks left
      const allIndices = claims.filter(r => r !== null) as number[];
      const unique = new Set(allIndices);
      expect(unique.size).toBe(allIndices.length); // no duplicates

      // Complete claimed tasks
      for (let i = 0; i < availableAgents.length; i++) {
        const agent = availableAgents[i];
        const idx = claims[i];
        if (idx !== null) {
          await team.completeTask(agent, idx, `done`);
        }
      }
    }
  }, 15000);
});
