import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentTeam } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';

describe('AgentTeam - Retry & Event Coverage', () => {
  let team: AgentTeam;

  afterEach(async () => {
    if (team) {
      await team.dispose();
    }
    vi.useRealTimers();
  });

  describe('handleAgentFailure - retry vs fail', () => {
    it('should retry when retryCount < max', async () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      await team.claimTask('agent-1');

      // Simulate first failure
      await team.handleAgentFailure('agent-1', 0, new Error('fail'));

      const teamAny = team as any;
      const task = teamAny.taskStatuses.get(0);
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(1);
      expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
    });

    it('should mark as failed after max retries', async () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      await team.claimTask('agent-1');

      const teamAny = team as any;
      const task = teamAny.taskStatuses.get(0);
      // Set to max-1 (DEFAULT_MAX_RETRIES = 3)
      task.retryCount = 2;

      await team.handleAgentFailure('agent-1', 0, new Error('final'));

      expect(task.status).toBe('failed');
      expect(task.result).toBe('final');
      expect(teamAny.pendingIndices).not.toContain(0);
    });
  });

  describe('retry backoff expiry', () => {
    it('should allow re-claim after retryAvailableAt passes', async () => {
      vi.useFakeTimers();
      team = new AgentTeam();
      team.setTeamId('test');

      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      // Claim task
      await team.claimTask('agent-1');

      // Simulate failure (backoff set)
      await team.handleAgentFailure('agent-1', 0, new Error('fail'));

      const teamAny = team as any;
      const task = teamAny.taskStatuses.get(0);
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(1);
      const backoffUntil = task.retryAvailableAt!;

      // Attempt claim before backoff expires -> null
      const idxNow = await team.claimTask('agent-1');
      expect(idxNow).toBeNull();

      // Advance time past backoff
      const remaining = backoffUntil - Date.now();
      if (remaining > 0) vi.advanceTimersByTime(remaining + 100);

      // Now should be claimable
      const idxLater = await team.claimTask('agent-1');
      expect(idxLater).toBe(0);
    });
  });

  describe('handleAgentEvent guards', () => {
    it('should ignore non-object events', () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const teamAny = team as any;
      // @ts-ignore – passing bad event
      teamAny.handleAgentEvent('role', 'string event');
      // No error
    });

    it('should ignore events without type property', () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const teamAny = team as any;
      // @ts-ignore
      teamAny.handleAgentEvent('role', { some: 'data' });
    });
  });
});
