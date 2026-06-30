import { AgentTeam } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';
import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest';

describe('AgentTeam Edge Cases', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.registerRuntime(createMockRuntime(), 'parent');
    team.registerRuntime(createMockRuntime(), 'agent-1');
    team.registerRuntime(createMockRuntime(), 'agent-2');
  });

  afterEach(async () => {
    if (team) {
      await team.dispose();
    }
  });

  test('completeTask should clear task assignee', async () => {
    await team.initialize(['task1']);
    const idx = await team.claimTask('agent-1');
    expect(idx).toBe(0);
    await team.completeTask('agent-1', idx!, 'result');
    const status = await team.getTeamStatus();
    const task = status.tasks.find(t => t.index === idx);
    expect(task?.assignee).toBeNull();
  });

  test('releaseTask should fail for completed task', async () => {
    await team.initialize(['task1']);
    const idx = await team.claimTask('agent-1');
    await team.completeTask('agent-1', idx!, 'result');
    const released = await team.releaseTask('agent-1', idx!);
    expect(released).toBe(false);
    // Ensure task still completed
    const status = await team.getTeamStatus();
    const task = status.tasks.find(t => t.index === idx);
    expect(task?.status).toBe('completed');
  });

  test('releaseTask should fail if task not assigned to agent', async () => {
    await team.initialize(['task1', 'task2']);
    const idx1 = await team.claimTask('agent-1');
    const idx2 = await team.claimTask('agent-2');
    // agent-1 tries to release idx2 (not assigned to it)
    const released = await team.releaseTask('agent-1', idx2!);
    expect(released).toBe(false);
  });

  test('released task should become pending and claimable by others', async () => {
    await team.initialize(['t1']);
    const idx = await team.claimTask('agent-1');
    await team.releaseTask('agent-1', idx!);
    // Now agent-2 should be able to claim
    const idx2 = await team.claimTask('agent-2');
    expect(idx2!).toBe(idx!);
    // Verify task status is in_progress and assignee is agent-2
    const status = await team.getTeamStatus();
    const task = status.tasks.find(t => t.index === idx);
    expect(task?.status).toBe('in_progress');
    expect(task?.assignee).toBe('agent-2');
  });

  test('agent failure simulation should release its task', async () => {
    await team.initialize(['t1', 't2']);
    // agent-1 claims t1
    const idx1 = await team.claimTask('agent-1');
    expect(idx1).toBe(0);
    // Simulate what runAgentLoop catch does:
    const currentTask = await team.getMyCurrentTask('agent-1');
    expect(currentTask).toBe(0);
    // Release it
    const released = await team.releaseTask('agent-1', currentTask!);
    expect(released).toBe(true);
    // Now agent-2 can claim t1
    const idx2 = await team.claimTask('agent-2');
    expect(idx2!).toBe(0);
    // agent-1 should have no current task
    expect(await team.getMyCurrentTask('agent-1')).toBeNull();
  });
});
