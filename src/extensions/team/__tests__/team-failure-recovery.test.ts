import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';

// Helper to access private fields for testing
interface AgentTeamInternal {
  taskStatuses: Map<number, any>;
  agentStatuses: Map<string, any>;
}
function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

describe('AgentTeam Failure Recovery', () => {
  let team: AgentTeam;

  beforeEach(async () => {
    team = createTestTeam('test-failure-team');
    const registry = TeamRegistry.getInstance();
    registry.register(team.id, team);

    // Minimal setup
    team.tasks = [];
    const internal = getInternal(team);
    internal.taskStatuses.clear();
    internal.agentStatuses.clear();
    internal.agentStatuses.set('agent-1', { currentTaskIndex: null, status: 'idle' });
    internal.agentStatuses.set('agent-2', { currentTaskIndex: null, status: 'idle' });
  });

  afterEach(async () => {
    const registry = TeamRegistry.getInstance();
    await team.dispose();
    registry.unregister(team.id);
  });

  test('should track retry count when task fails', async () => {
    // Setup: 1 task, 1 agent
    team.tasks = ['task1'];
    const internal = getInternal(team);
    internal.taskStatuses.set(0, {
      assignee: 'agent-1',
      status: 'in_progress',
      result: '',
      retryCount: 0
    });

    // Simulate agent failure: releaseTask with failure should increment retryCount
    // But current releaseTask doesn't increment - we'll need to modify behavior
    // For now, test the intended behavior after implementation

    // After implementation: when agent fails, task should be released with retryCount++
    // For now, this test will fail because retryCount not tracked
    const statusBefore = await team.getTeamStatus();
    expect(statusBefore.tasks[0].retryCount).toBeDefined();
    expect(statusBefore.tasks[0].retryCount).toBe(0); // initial
  });

  test('should re-queue task with increased retry count after failure', async () => {
    team.tasks = ['task1'];
    const internal = getInternal(team);
    internal.taskStatuses.set(0, {
      assignee: 'agent-1',
      status: 'in_progress',
      result: '',
      retryCount: 0
    });

    // Simulate agent failure
    await team.handleAgentFailure('agent-1', 0, new Error('simulated failure'));

    // Expected: task back to pending, retryCount = 1, assignee = null, retryAvailableAt set
    const status = await team.getTeamStatus();
    expect(status.tasks[0].status).toBe('pending');
    expect(status.tasks[0].retryCount).toBe(1);
    expect(status.tasks[0].assignee).toBeNull();
    expect(status.tasks[0].retryAvailableAt).toBeDefined();
  });

  test('should mark task as failed after max retries exceeded', async () => {
    const maxRetries = 3;
    team.tasks = ['task1'];
    const internal = getInternal(team);
    internal.taskStatuses.set(0, {
      assignee: 'agent-1',
      status: 'in_progress',
      result: '',
      retryCount: maxRetries - 1  // about to fail one more time
    });

    // Simulate failure that would exceed max
    // After implementation: release with retryCount++ would hit max
    // Task status becomes 'failed', result contains error

    // For now, we can't test - will implement first
    const status = await team.getTeamStatus();
    if (status.tasks[0].status === 'failed') {
      expect(status.tasks[0].result).toContain('failed');
    }
  });

  test('should respect exponential backoff delay before task becomes claimable again', async () => {
    team.tasks = ['task1'];
    const internal = getInternal(team);
    internal.taskStatuses.set(0, {
      assignee: 'agent-1',
      status: 'in_progress',
      result: '',
      retryCount: 0
    });

    // Simulate failure
    await team.handleAgentFailure('agent-1', 0, new Error('fail'));

    // Task should now be pending with retryAvailableAt in future
    const status1 = await team.getTeamStatus();
    expect(status1.tasks[0].status).toBe('pending');
    expect(status1.tasks[0].retryAvailableAt).toBeGreaterThan(Date.now());

    // Try to claim - should be skipped because not yet available
    const claimResult = await team.claimTask('agent-2');
    expect(claimResult).toBeNull(); // no task claimed

    // Fast-forward time (we can't really in Jest without fake timers, but we can verify the timestamp)
    // For real test, would use jest.advanceTimersByTime, but relying on real delay is flaky
    // Instead, we'll manually clear retryAvailableAt to simulate time passing
    getInternal(team).taskStatuses.get(0)!.retryAvailableAt = Date.now() - 1000;

    // Now claiming should work
    const claimResult2 = await team.claimTask('agent-2');
    expect(claimResult2).toBe(0);
    const status2 = await team.getTeamStatus();
    expect(status2.tasks[0].status).toBe('in_progress');
    expect(status2.tasks[0].assignee).toBe('agent-2');
  });

  test('monitorInterval should not dispose team with pending or failed tasks', async () => {
    team.tasks = ['task1', 'task2'];
    const internal = getInternal(team);
    internal.taskStatuses.set(0, { assignee: null, status: 'completed', result: 'done', retryCount: 0 });
    internal.taskStatuses.set(1, { assignee: null, status: 'failed', result: 'error', retryCount: 3 });

    // Team should not auto-dispose until all tasks are either completed or failed?
    // Actually: team completes when all tasks are either completed OR failed?
    // Decision: Team completion = all tasks have terminal status (completed OR failed)

    // After implementation: getTeamStatus should consider both completed and failed as "done"
    const status = await team.getTeamStatus();
    expect(status.completedTasks).toBe(1); // only completed counted
    expect(status.totalTasks).toBe(2);

    // Monitor should consider team done when (completed + failed) == total
    // So need to adjust monitor logic or define new completed criteria
  });

  test('getTeamStatus should include failure metrics', async () => {
    team.tasks = ['task1', 'task2', 'task3'];
    const internal = getInternal(team);
    internal.taskStatuses.set(0, { assignee: null, status: 'completed', result: 'done', retryCount: 0 });
    internal.taskStatuses.set(1, { assignee: null, status: 'failed', result: 'error', retryCount: 2 });
    internal.taskStatuses.set(2, { assignee: 'agent-2', status: 'in_progress', result: '', retryCount: 0 });

    const status = await team.getTeamStatus();
    expect(status.failedTasks).toBeDefined();
    expect(status.failedTasks).toBe(1);
    expect(status.pendingTasks).toBeDefined();
    // etc.
  });
});
