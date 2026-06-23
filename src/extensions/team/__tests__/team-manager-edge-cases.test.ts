import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentTeam } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';

describe('AgentTeam - Edge Cases', () => {
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

  describe('dispose', () => {
    it('should handle multiple dispose calls safely', async () => {
      // Second dispose on already disposed should be no-op
      await team.dispose();
      await team.dispose(); // should not throw
    });

    it('should clear monitorInterval when set', async () => {
      // Set fake interval
      (team as any).monitorInterval = setInterval(() => {}, 1000);
      expect((team as any).monitorInterval).not.toBeNull();

      await team.dispose();

      // After dispose, monitorInterval should be null
      expect((team as any).monitorInterval).toBeNull();
    });
  });

  describe('insertPendingIndexSorted', () => {
    it('should avoid inserting duplicate index', () => {
      const teamAny = team as any;
      teamAny.pendingIndices = [];
      // Call directly to preserve this binding
      teamAny.insertPendingIndexSorted(5);
      expect(teamAny.pendingIndices).toEqual([5]);

      teamAny.insertPendingIndexSorted(5); // duplicate
      expect(teamAny.pendingIndices).toEqual([5]); // unchanged
    });

    it('should maintain sorted order', () => {
      const teamAny = team as any;
      teamAny.pendingIndices = [];
      teamAny.insertPendingIndexSorted(10);
      teamAny.insertPendingIndexSorted(2);
      teamAny.insertPendingIndexSorted(7);
      teamAny.insertPendingIndexSorted(5);

      expect(teamAny.pendingIndices).toEqual([2, 5, 7, 10]);
    });
  });

  describe('claimTask', () => {
    it('should return null when no tasks pending', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize([]); // empty tasks

      const result = await team.claimTask('agent-1');
      expect(result).toBeNull();
    });
  });

  describe('getResults', () => {
    it('should return empty array when no tasks', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize([]);

      const results = await team.getResults();
      expect(results).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('should work even if called multiple times (idempotent)', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize(['task1']);
      // second initialize should not throw
      await team.initialize(['task1']);
    });
  });

  describe('handleAgentFailure', () => {
    it('should retry task when retryCount below max', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize(['taskA']);

      // Agent claims task
      const idx = await team.claimTask('agent-1');
      expect(idx).toBe(0);

      // Simulate failure
      await team.handleAgentFailure('agent-1', idx!, new Error('oops'));

      // Task should be back to pending with retryCount = 1 and retryAvailableAt set
      const teamAny = team as any;
      const task = teamAny.taskStatuses.get(0);
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(1);
      expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
      // Should be back in pendingIndices
      expect(teamAny.pendingIndices).toContain(0);
    });

    it('should mark task as failed after max retries', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize(['taskB']);

      const teamAny = team as any;
      // Manually set retryCount to max-1 to simulate near limit
      const idx = await team.claimTask('agent-1');
      expect(idx).toBe(0);
      // Directly set retryCount to 2 (DEFAULT_MAX_RETRIES=3, so one more failure will exceed)
      const task = teamAny.taskStatuses.get(0);
      task.retryCount = 2;

      // Simulate failure
      await team.handleAgentFailure('agent-1', 0, new Error('fail'));

      // After this, retryCount becomes 3 (>=3) so task should be failed
      expect(task.status).toBe('failed');
      expect(task.result).toBe('fail');
      // Should be removed from pendingIndices
      expect(teamAny.pendingIndices).not.toContain(0);
    });
  });

  describe('getTeamStatus', () => {
    it('should report correct counts after tasks complete', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize(['task1', 'task2']);

      const status1 = await team.getTeamStatus();
      expect(status1.totalTasks).toBe(2);
      expect(status1.completedTasks).toBe(0);
      expect(status1.pendingTasks).toBe(2);

      // Complete first task via reportResult
      await team.reportResult(0, 'done');

      const status2 = await team.getTeamStatus();
      expect(status2.completedTasks).toBe(1);
      expect(status2.pendingTasks).toBe(1);
      expect(status2.isComplete).toBe(false);

      await team.reportResult(1, 'done');
      const status3 = await team.getTeamStatus();
      expect(status3.completedTasks).toBe(2);
      expect(status3.isComplete).toBe(true);
    });
  });

  describe('releaseTask', () => {
    it('should return false when task does not exist', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize(['task0']);
      const result = await team.releaseTask('agent-1', 99);
      expect(result).toBe(false);
    });

    it('should return false when task assigned to another agent', async () => {
      const r1 = createMockRuntime(); r1.session.sessionId = 'agent1'; team.registerRuntime(r1, 'agent-1');
      const r2 = createMockRuntime(); r2.session.sessionId = 'agent2'; team.registerRuntime(r2, 'agent-2');
      await team.initialize(['task0']);
      await team.claimTask('agent1');
      const result = await team.releaseTask('agent2', 0);
      expect(result).toBe(false);
    });

    it('should release successfully when assigned to same agent', async () => {
      const runtime = createMockRuntime();
      runtime.session.sessionId = 'agent-1';
      team.registerRuntime(runtime, 'agent-1');
      await team.initialize(['task0']);
      const idx = await team.claimTask('agent-1');
      expect(idx).toBe(0);
      const released = await team.releaseTask('agent-1', 0);
      expect(released).toBe(true);
      // Task should be back to pending
      const teamAny = team as any;
      const task = teamAny.taskStatuses.get(0);
      expect(task.status).toBe('pending');
      expect(teamAny.pendingIndices).toContain(0);
      expect(task.assignee).toBeNull();
    });
  });
});
