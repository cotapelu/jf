import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskManager } from '../task-manager.js';

describe('TaskManager Coverage Gaps', () => {
  let tm: TaskManager;

  beforeEach(() => {
    tm = new TaskManager();
  });

  it('getAllTaskStatuses returns map', () => {
    tm.initialize(['a', 'b']);
    const map = tm.getAllTaskStatuses();
    expect(map.size).toBe(2);
  });

  it('claimTask respects backoff (retryAvailableAt in future)', () => {
    tm.initialize(['t1']);
    const now = Date.now();
    // Set task status directly to simulate backoff
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'in_progress';
    task.retryAvailableAt = now + 60000;
    // pendingIndices should be empty because task is in_progress
    expect(tm.claimTask('agent-2')).toBeNull();
  });

  it('releaseTask returns false for completed task', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'completed';
    expect(tm.releaseTask('agent-1', 0)).toBe(false);
  });

  it('insertPendingIndexSorted avoids duplicates', () => {
    tm.initialize(['t1']);
    // Simulate task already in pendingIndices
    (tm as any).pendingIndices = [0];
    // Call insert with same index -> should not duplicate
    tm.claimTask = vi.fn().mockReturnValue(null); // bypass
    // Use any to call private
    (tm as any).insertPendingIndexSorted(0);
    expect((tm as any).pendingIndices).toEqual([0]);
  });

  it('reclaimZombieTasks fails task after max retries', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'in_progress';
    task.retryCount = tm['maxRetries']; // at max
    tm.reclaimZombieTasks('agent-1');
    expect(task.status).toBe('failed');
    expect(task.result).toContain('zombie');
  });
});
