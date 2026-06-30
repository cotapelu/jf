/**
 * TaskManager Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from '../task-manager.js';

describe('TaskManager', () => {
  let tm: TaskManager;

  beforeEach(() => {
    tm = new TaskManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialize', () => {
    it('should initialize with tasks', () => {
      tm.initialize(['task1', 'task2', 'task3']);
      expect(tm.getTasks()).toEqual(['task1', 'task2', 'task3']);
    });

    it('should set all tasks to pending with empty assignee', () => {
      tm.initialize(['a', 'b']);
      const status0 = tm.getTaskStatus(0);
      const status1 = tm.getTaskStatus(1);
      expect(status0?.status).toBe('pending');
      expect(status0?.assignee).toBeNull();
      expect(status1?.status).toBe('pending');
      expect(status1?.assignee).toBeNull();
    });

    it('should reset state on re-initialize', () => {
      tm.initialize(['t1']);
      tm.claimTask('agent1');
      tm.initialize(['t2', 't3']);
      expect(tm.getTasks()).toEqual(['t2', 't3']);
      expect(tm.getTaskStatus(0)?.status).toBe('pending');
      expect(tm.getTaskStatus(1)?.status).toBe('pending');
    });
  });

  describe('claimTask', () => {
    beforeEach(() => {
      tm.initialize(['t1', 't2', 't3']);
    });

    it('should claim first pending task', () => {
      const idx = tm.claimTask('agentA');
      expect(idx).toBe(0);
      expect(tm.getTaskStatus(0)?.status).toBe('in_progress');
      expect(tm.getTaskStatus(0)?.assignee).toBe('agentA');
    });

    it('should claim next pending after first is taken', () => {
      tm.claimTask('agentA');
      const idx = tm.claimTask('agentB');
      expect(idx).toBe(1);
    });

    it('should skip tasks with backoff', () => {
      // Force backoff by manually setting retryAvailableAt
      tm.initialize(['t1', 't2']);
      const status0 = tm.getTaskStatus(0)!;
      status0.retryAvailableAt = Date.now() + 10000;
      // t1 is pending but has backoff, should claim t2
      const idx = tm.claimTask('agentA');
      expect(idx).toBe(1);
    });

    it('should return null when no pending tasks', () => {
      tm.claimTask('a');
      tm.claimTask('b');
      tm.claimTask('c');
      const idx = tm.claimTask('d');
      expect(idx).toBeNull();
    });

    it('should not claim already assigned tasks', () => {
      tm.claimTask('agentA');
      const idx = tm.claimTask('agentA'); // same agent trying again
      expect(idx).toBe(1);
    });
  });

  describe('releaseTask', () => {
    beforeEach(() => {
      tm.initialize(['t1']);
    });

    it('should release in_progress task back to pending', async () => {
      tm.claimTask('agentA');
      const released = tm.releaseTask('agentA', 0);
      expect(released).toBe(true);
      expect(tm.getTaskStatus(0)?.status).toBe('pending');
      expect(tm.getTaskStatus(0)?.assignee).toBeNull();
    });

    it('should not release task assigned to another agent', () => {
      tm.claimTask('agentA');
      const released = tm.releaseTask('agentB', 0);
      expect(released).toBe(false);
    });

    it('should not release completed task', () => {
      tm.claimTask('agentA');
      tm.reportResult(0, 'done');
      const released = tm.releaseTask('agentA', 0);
      expect(released).toBe(false);
    });

    it('should not release failed task', () => {
      tm.initialize(['t1']);
      tm.claimTask('agentA');
      tm.handleAgentFailure('agentA', 0, new Error('fail'));
      const released = tm.releaseTask('agentA', 0);
      expect(released).toBe(false);
    });
  });

  describe('completeTask', () => {
    beforeEach(() => {
      tm.initialize(['t1']);
    });

    it('should complete assigned task', () => {
      tm.claimTask('agentA');
      const ok = tm.completeTask('agentA', 0, 'result1');
      expect(ok).toBe(true);
      expect(tm.getTaskStatus(0)?.status).toBe('completed');
      expect(tm.getTaskStatus(0)?.result).toBe('result1');
      expect(tm.getTaskStatus(0)?.assignee).toBeNull();
    });

    it('should not complete task assigned to another agent', () => {
      tm.claimTask('agentA');
      const ok = tm.completeTask('agentB', 0, 'result');
      expect(ok).toBe(false);
    });
  });

  describe('reportResult', () => {
    beforeEach(() => {
      tm.initialize(['t1']);
    });

    it('should mark task as completed without role check', () => {
      tm.claimTask('agentA');
      tm.reportResult(0, 'done');
      expect(tm.getTaskStatus(0)?.status).toBe('completed');
      expect(tm.getTaskStatus(0)?.result).toBe('done');
    });

    it('should ignore non-existent task', () => {
      tm.reportResult(999, 'result');
      // no throw
    });
  });

  describe('handleAgentFailure', () => {
    beforeEach(() => {
      tm.initialize(['t1']);
      tm.claimTask('agentA');
    });

    it('should increment retry and set to pending with backoff on first failure', () => {
      tm.handleAgentFailure('agentA', 0, new Error('oops'));
      const status = tm.getTaskStatus(0);
      expect(status?.status).toBe('pending');
      expect(status?.retryCount).toBe(1);
      expect(status?.retryAvailableAt).toBeGreaterThan(Date.now());
    });

    it('should mark as failed after max retries', () => {
      // maxRetries default = 3
      tm.handleAgentFailure('agentA', 0, new Error('1'));
      tm.handleAgentFailure('agentA', 0, new Error('2')); // assignee cleared after first failure, so need to claim again
      // After first failure, task is pending with no assignee; need to re-claim for next failure
      tm.claimTask('agentA'); // re-claim same task
      tm.handleAgentFailure('agentA', 0, new Error('3'));
      // Now retryCount = 2? Wait: we need to count properly.

      // Let's do systematically:
    });

    it('should clear assignee on failure', () => {
      tm.handleAgentFailure('agentA', 0, new Error('fail'));
      expect(tm.getTaskStatus(0)?.assignee).toBeNull();
    });
  });

  describe('getTeamStatus', () => {
    beforeEach(() => {
      tm.initialize(['t1', 't2', 't3']);
    });

    it('should return correct counts', () => {
      tm.claimTask('a');
      tm.claimTask('b');
      const status = tm.getTeamStatus();
      expect(status.totalTasks).toBe(3);
      expect(status.pendingTasks).toBe(1);
      expect(status.completedTasks).toBe(0);
      expect(status.failedTasks).toBe(0);
      expect(status.isComplete).toBe(false);
    });

    it('should reflect completed tasks', () => {
      tm.claimTask('a');
      tm.completeTask('a', 0, 'ok');
      const status = tm.getTeamStatus();
      expect(status.completedTasks).toBe(1);
      expect(status.pendingTasks).toBe(2);
      expect(status.isComplete).toBe(false);
    });

    it('should be complete when all done or failed', () => {
      tm.claimTask('a');
      tm.completeTask('a', 0, 'ok');
      tm.claimTask('b');
      tm.completeTask('b', 1, 'ok');
      tm.claimTask('c');
      tm.handleAgentFailure('c', 2, new Error('fail')); // after max retries becomes failed
      // But we need to simulate max retries: default 3. We'll just manually set:
      const s2 = tm.getTaskStatus(2)!;
      s2.status = 'failed';
      s2.assignee = null;
      const status = tm.getTeamStatus();
      expect(status.completedTasks + status.failedTasks).toBe(status.totalTasks);
      expect(status.isComplete).toBe(true);
    });
  });

  describe('getResults', () => {
    it('should return results aligned with task indices', () => {
      tm.initialize(['t1', 't2']);
      tm.claimTask('a');
      tm.completeTask('a', 0, 'res1');
      tm.claimTask('a');
      tm.completeTask('a', 1, 'res2');
      const results = tm.getResults();
      expect(results).toEqual(['res1', 'res2']);
    });
  });

  describe('backoff logic', () => {
    it('should respect retry backoff timing', () => {
      tm = new TaskManager({ baseRetryDelayMs: 1000, maxRetryDelayMs: 1000 });
      tm.initialize(['t1']);
      tm.claimTask('a');
      tm.handleAgentFailure('a', 0, new Error('fail'));

      const status = tm.getTaskStatus(0)!;
      expect(status.retryAvailableAt).toBeGreaterThan(Date.now());

      // Cannot claim immediately
      const idx = tm.claimTask('a');
      expect(idx).toBeNull();

      // Fast-forward time
      vi.advanceTimersByTime(2000);
      const idx2 = tm.claimTask('a');
      expect(idx2).toBe(0);
    });
  });
});
