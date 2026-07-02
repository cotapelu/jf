import { AgentTeam } from '../team-manager.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockRuntime } from './test-utils.js';

describe('AgentTeam additional coverage', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
    const parent = createMockRuntime();
    parent.session.sessionId = 'parent-session';
    team.registerRuntime(parent, 'parent');
    const agent = createMockRuntime();
    agent.session.sessionId = 'agent-session';
    team.registerRuntime(agent, 'agent-1');
  });

  afterEach(async () => {
    await team.dispose();
  });

  describe('insertPendingIndexSorted', () => {
    it('should insert index in sorted order', () => {
      (team as any).pendingIndices = [];
      (team as any).insertPendingIndexSorted(5);
      (team as any).insertPendingIndexSorted(3);
      (team as any).insertPendingIndexSorted(7);
      expect((team as any).pendingIndices).toEqual([3,5,7]);
    });

    it('should not duplicate existing index', () => {
      (team as any).pendingIndices = [2,4,6];
      (team as any).insertPendingIndexSorted(4);
      expect((team as any).pendingIndices).toEqual([2,4,6]);
    });

    it('should insert and avoid duplicate after insertion', () => {
      (team as any).pendingIndices = [2,4,6];
      (team as any).insertPendingIndexSorted(5);
      expect((team as any).pendingIndices).toEqual([2,4,5,6]);
      (team as any).insertPendingIndexSorted(5);
      expect((team as any).pendingIndices).toEqual([2,4,5,6]);
    });
  });

  describe('claimTask backoff', () => {
    it('should skip task with retryAvailableAt in future', async () => {
      await team.initialize(['t1']);
      const taskIndex = 0;
      const task = (team as any).taskStatuses.get(taskIndex);
      // Set retryAvailableAt to future
      task.retryAvailableAt = Date.now() + 10000;
      // Ensure pendingIndices contains this task
      (team as any).pendingIndices = [taskIndex];
      const claimed = await team.claimTask('agent-1');
      expect(claimed).toBeNull();
    });
  });
});
