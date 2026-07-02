/**
 * Tests for AgentTeam backoff and retry behavior.
 */

import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';

// Helper to access private fields for testing
interface AgentTeamInternal {
  taskStatuses: Map<number, any>;
  agentLastSeen: Map<string, number>;
  reclaimZombieAgents: () => void;
  updateHeartbeat: (agentId: string) => void;
}
function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

describe('AgentTeam Backoff & Retry', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = createTestTeam('test-backoff');
    const registry = TeamRegistry.getInstance();
    registry.register(team.id, team);
    team.registerRuntime(createMockRuntime(), 'parent');
    team.registerRuntime(createMockRuntime(), 'agent-1');
  });

  afterEach(async () => {
    const registry = TeamRegistry.getInstance();
    await team.dispose();
    registry.unregister(team.id);
  });

  it('should apply backoff when task is released with retry', async () => {
    await team.initialize(['task1']);
    // Agent-1 claims task
    const idx = (await team.claimTask('agent-1'))!;
    expect(idx).toBe(0);

    // Simulate release with error causing retry (by using handleAgentFailure)
    await team.handleAgentFailure('agent-1', idx, new Error('fail'));

    const status = await team.getTeamStatus();
    expect(status.tasks[0].status).toBe('pending');
    expect(status.tasks[0].retryCount).toBe(1);
    expect((status.tasks[0].retryAvailableAt as number)).toBeGreaterThan(Date.now() + 900);
  });

  it('should increment retryCount on each failure (manual backoff expiry)', async () => {
    await team.initialize(['task1']);
    const idx = (await team.claimTask('agent-1'))!;
    expect(idx).toBe(0);

    // Fail first time
    await team.handleAgentFailure('agent-1', idx, new Error('fail1'));
    const task1 = getInternal(team).taskStatuses.get(idx);
    expect(task1.retryCount).toBe(1);
    expect(task1.status).toBe('pending');
    // Expire backoff to allow immediate reclaim for test
    task1.retryAvailableAt = 0;

    // Re-claim
    const idx2 = (await team.claimTask('agent-1'))!;
    expect(idx2).toBe(0);

    // Fail second time
    await team.handleAgentFailure('agent-1', idx2, new Error('fail2'));
    const task2 = getInternal(team).taskStatuses.get(idx);
    expect(task2.retryCount).toBe(2);
    expect(task2.status).toBe('pending');
    task2.retryAvailableAt = 0;

    // Re-claim
    const idx3 = (await team.claimTask('agent-1'))!;
    expect(idx3).toBe(0);

    // Fail third time -> should mark failed
    await team.handleAgentFailure('agent-1', idx3, new Error('fail3'));
    const task3 = getInternal(team).taskStatuses.get(idx);
    expect(task3.status).toBe('failed');
    expect(task3.retryCount).toBe(3);
    expect(task3.retryAvailableAt).toBeUndefined();
  });

  it('should reclaim zombie task and increment retry', async () => {
    await team.initialize(['task1']);
    const idx = await team.claimTask('agent-1');
    expect(idx).toBe(0);

    // Simulate zombie: set lastSeen in the past
    getInternal(team).agentLastSeen.set('agent-1', Date.now() - 2 * 60 * 1000 - 1000);

    // Call reclaimZombieAgents directly
    getInternal(team).reclaimZombieAgents();

    const status = await team.getTeamStatus();
    expect(status.tasks[0].assignee).toBeNull();
    expect(status.tasks[0].status).toBe('pending'); // goes back to pending for retry
    expect(status.tasks[0].retryCount).toBe(1);
  });

  it('should not reclaim active agent tasks', async () => {
    await team.initialize(['task1']);
    const idx = await team.claimTask('agent-1');

    // Update heartbeat recently
    getInternal(team).updateHeartbeat('agent-1');

    // Reclaim should not affect
    getInternal(team).reclaimZombieAgents();

    const status = await team.getTeamStatus();
    expect(status.tasks[0].status).toBe('in_progress');
    expect(status.tasks[0].assignee).toBe('agent-1');
  });
});
