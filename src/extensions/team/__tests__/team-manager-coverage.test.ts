import { describe, it, expect, beforeEach, afterEach, vi, useFakeTimers } from 'vitest';
import { AgentTeam } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';

describe('AgentTeam - Coverage Gaps', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
  });

  afterEach(async () => {
    if (team) {
      await team.dispose();
    }
  });

  describe('claimTask() - skip already claimed', () => {
    it('should not reassign a task already claimed by another agent', async () => {
      const rt1 = createMockRuntime();
      rt1.session.sessionId = 'agent1-session';
      team.registerRuntime(rt1, 'agent-1');

      const rt2 = createMockRuntime();
      rt2.session.sessionId = 'agent2-session';
      team.registerRuntime(rt2, 'agent-2');

      await team.initialize(['taskA', 'taskB']);

      // agent-1 claims first task
      const idx1 = await team.claimTask('agent1-session');
      expect(idx1).toBe(0);

      // agent-2 attempts to claim same task via role mapping should get taskB (index 1)
      const idx2 = await team.claimTask('agent2-session');
      expect(idx2).toBe(1);

      // Verify assignment statuses
      expect(await team.getMyCurrentTask('agent1-session')).toBe(0);
      expect(await team.getMyCurrentTask('agent2-session')).toBe(1);
    });
  });

  describe('releaseTask() guards', () => {
    it('should return false for task assigned to different agent', async () => {
      const rt1 = createMockRuntime();
      rt1.session.sessionId = 'agent1-session';
      team.registerRuntime(rt1, 'agent-1');

      const rt2 = createMockRuntime();
      rt2.session.sessionId = 'agent2-session';
      team.registerRuntime(rt2, 'agent-2');

      await team.initialize(['task0']);
      await team.claimTask('agent1-session');

      const released = await team.releaseTask('agent2-session', 0);
      expect(released).toBe(false);
      // Task should still be assigned to agent-1
      expect(await team.getMyCurrentTask('agent1-session')).toBe(0);
    });

    it('should return false for task already completed', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent1-session';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      await team.claimTask('agent1-session');
      await team.completeTask('agent1-session', 0, 'done');

      const released = await team.releaseTask('agent1-session', 0);
      expect(released).toBe(false);
    });

    it('should return false for non-existent task index', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent1-session';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      const released = await team.releaseTask('agent1-session', 99);
      expect(released).toBe(false);
    });
  });

  describe('completeTask() - reassignment protection', () => {
    it('should be no-op when task not assigned to calling agent', async () => {
      const rt1 = createMockRuntime();
      rt1.session.sessionId = 'agent1-session';
      team.registerRuntime(rt1, 'agent-1');

      const rt2 = createMockRuntime();
      rt2.session.sessionId = 'agent2-session';
      team.registerRuntime(rt2, 'agent-2');

      await team.initialize(['taskX']);

      // agent-2 claims taskX
      await team.claimTask('agent2-session');

      // agent-1 tries to complete it
      await team.completeTask('agent1-session', 0, 'hacked');

      // Task should still be pending/assigned to agent-2, not completed
      const results = await team.getResults();
      expect(results[0]).toBe(''); // empty result means not completed
    });
  });

  describe('getMyCurrentTask() - unknown agent', () => {
    it('should return null for agent not in team', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-known';
      team.registerRuntime(rt, 'known-agent');
      await team.initialize(['task0']);

      expect(await team.getMyCurrentTask('unknown-agent')).toBeNull();
    });

    it('should return null when agent has no current task', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent1-session';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      // After initialize, no task claimed yet
      expect(await team.getMyCurrentTask('agent1-session')).toBeNull();
    });
  });

  describe('handleAgentFailure() - retry/backoff', () => {
    it('should reset to pending with backoff after failure', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent1-session';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      // Claim task
      await team.claimTask('agent1-session');

      // Simulate failure
      await team.handleAgentFailure('agent1-session', 0, new Error('oops'));

      const teamAny = team as any;
      const task = teamAny.taskStatuses.get(0);
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(1);
      expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
      // task index back in pendingIndices
      expect(teamAny.pendingIndices).toContain(0);
      // Agent status cleared
      expect(teamAny.agentStatuses.get('agent-1').currentTaskIndex).toBeNull();
    });

    it('should mark as failed after exceeding max retries', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent1-session';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      // Claim and set retryCount near max
      await team.claimTask('agent1-session');
      const teamAny = team as any;
      const task = teamAny.taskStatuses.get(0);
      task.retryCount = 2; // DEFAULT_MAX_RETRIES = 3, one more failure -> fail

      await team.handleAgentFailure('agent1-session', 0, new Error('final'));

      expect(task.status).toBe('failed');
      expect(task.result).toBe('final');
      expect(teamAny.pendingIndices).not.toContain(0);
    });
  });

  describe('getTeamStatus() - summary calculations', () => {
    it('should correctly count failed tasks', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent1-session';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['t1', 't2', 't3']);

      // fail one task via handleAgentFailure (max retries)
      await team.claimTask('agent1-session');
      const teamAny = team as any;
      const t0 = teamAny.taskStatuses.get(0);
      t0.retryCount = 2;
      await team.handleAgentFailure('agent1-session', 0, new Error('fail'));

      const status = await team.getTeamStatus();
      expect(status.failedTasks).toBe(1);
      expect(status.completedTasks).toBe(0);
      expect(status.pendingTasks).toBe(2);
      expect(status.totalTasks).toBe(3);
      expect(status.isComplete).toBe(false);
    });

    it('should mark isComplete when all tasks completed', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent1-session';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['t1', 't2']);

      // Complete both via reportResult
      await team.claimTask('agent1-session');
      await team.reportResult(0, 'done');
      // After completing first, pendingIndices updated? reportResult does not remove from pendingIndices; we need to adjust?
      // In reportResult, task is marked completed but pendingIndices may still contain index. That's okay.
      // We'll directly complete second by retrieving next task? Actually after first, the team still has pendingIndices with [1]? Let's just call reportResult for index 1 regardless (the method just marks completed without assignment check). We'll bypass guard.
      const teamAny = team as any;
      const task1 = teamAny.taskStatuses.get(1);
      // manually set assignee to agent-1 to simulate it was claimed? Actually reportResult doesn't check assignment, it finds task by index and marks completed, also sets assignee null. So safe to call directly.
      await team.reportResult(1, 'done');

      const status = await team.getTeamStatus();
      expect(status.completedTasks).toBe(2);
      expect(status.isComplete).toBe(true);
    });
  });

  describe('dispose() cleanup variations', () => {
    it('should handle dispose when childControllers empty', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'parent';
      team.registerRuntime(rt, 'parent');
      await team.initialize(['task']);
      // No child agent loops started → childControllers empty
      await team.dispose();
      expect((team as any).disposed).toBe(true);
    });

    it('should handle dispose when childPromises empty', async () => {
      const rt = createMockRuntime();
      rt.session.sessionId = 'parent';
      team.registerRuntime(rt, 'parent');
      await team.initialize(['task']);
      // No child loops → childPromises empty
      await team.dispose();
      expect((team as any).childPromises).toEqual([]);
    });
  });


});
