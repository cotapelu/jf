import { describe, it, expect } from 'vitest';
import { TeamRegistry, AgentTeam } from '../extensions/team/team-manager.js';

describe('TeamManager coverage gaps', () => {
  describe('TeamRegistry.waitForTeam', () => {
    it('should throw when team not found', async () => {
      const registry = TeamRegistry.getInstance();
      await expect(registry.waitForTeam('non-existent')).rejects.toThrow('Team non-existent not found in registry');
    });
  });

  describe('AgentTeam.handleAgentFailure', () => {
    it('should retry failed task with backoff', async () => {
      const team = new AgentTeam();
      team.setTeamId('retry-test');
      await team.initialize(['Task 1']);
      // Claim task for agent
      const idx = await team.claimTask('agent1');
      expect(idx).toBe(0);
      // Simulate failure
      await team.handleAgentFailure('agent1', 0);
      // Verify task requeued
      const anyTeam = team as unknown as {
        taskStatuses: Map<number, { status: string; retryCount: number; retryAvailableAt: number }>;
        agentLastSeen: Map<string, number>;
      };
      const task = anyTeam.taskStatuses.get(0);
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(1);
      // retryAvailableAt should be in the near future (base delay 1000ms)
      expect(task.retryAvailableAt).toBeGreaterThan(Date.now() - 100);
      expect(task.retryAvailableAt).toBeLessThan(Date.now() + 2000);
    });
  });

  describe('AgentTeam.reclaimZombieAgents', () => {
    it('should reclaim zombie task and retry', async () => {
      const team = new AgentTeam();
      team.setTeamId('zombie-test');
      await team.initialize(['Task']);
      const idx = await team.claimTask('agent2');
      expect(idx).toBe(0);
      // Set agent last seen far in the past to trigger zombie detection
      const anyTeam = team as unknown as {
        taskStatuses: Map<number, { status: string; retryCount: number; retryAvailableAt: number }>;
        agentLastSeen: Map<string, number>;
      };
      anyTeam.agentLastSeen.set('agent2', Date.now() - 10 * 60 * 1000); // 10 minutes ago
      // Call reclaimZombieAgents
      team.reclaimZombieAgents();
      // Verify task state
      const task = anyTeam.taskStatuses.get(0);
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(1);
      expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
    });
  });
});
