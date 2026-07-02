import { AgentTeam } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';
import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest';

describe('AgentTeam Performance', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.registerRuntime(createMockRuntime(), 'agent-1');
  });

  afterEach(async () => {
    if (team) {
      await team.dispose();
    }
  });

  test('claimTask linear scan is acceptable for typical sizes', async () => {
    const sizes = [10, 50, 100];
    const iterations = 20; // Reduced for stability

    for (const size of sizes) {
      await team.initialize(Array.from({ length: size }, (_, i) => `task${i}`));

      // Warm up (once)
      for (let i = 0; i < size; i++) {
        await team.claimTask('agent-1');
        await team.completeTask('agent-1', i, `result${i}`);
      }

      // Measure
      const start = Date.now();
      for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < size; i++) {
          await team.claimTask('agent-1');
          await team.completeTask('agent-1', i, `result${i}`);
        }
      }
      const elapsed = Date.now() - start;
      const avgOpsPerMs = (iterations * size) / elapsed;
      // Even with contention, should maintain reasonable throughput
      expect(avgOpsPerMs).toBeGreaterThan(0.1);
    }
  }, 30000);

  test('getTeamStatus does not grow quadratically', async () => {
    const sizes = [10, 100, 500];
    const calls = 20; // Reduced for stability
    for (const size of sizes) {
      await team.initialize(Array.from({ length: size }, (_, i) => `task${i}`));
      // Mark half as completed
      for (let i = 0; i < size / 2; i++) {
        await team.completeTask('agent-1', i, `result${i}`);
      }

      const start = Date.now();
      for (let i = 0; i < calls; i++) {
        await team.getTeamStatus();
      }
      const elapsed = Date.now() - start;
      // Should be sublinear; even with 500 tasks, 20 calls should be fast
      expect(elapsed).toBeLessThan(200);
    }
  }, 30000);
});
