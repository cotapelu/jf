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
});
