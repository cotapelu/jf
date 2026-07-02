import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';

// Helper to access private fields for testing
interface AgentTeamInternal {
  agentLastSeen: Map<string, number>;
  taskStatuses: Map<number, any>;
  pendingIndices: number[];
  agentStatuses: Map<string, any>;
  roleByAgentId: Map<string, string>;
  notifyUpdate: (update: any) => void;
  createUpdate: (msg: string, details?: any, isError?: boolean) => any;
}
function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

describe('AgentTeam Zombie Recovery', () => {
  let team: AgentTeam;
  const AGENT_TIMEOUT_MS = 2 * 60 * 1000; // should match constant

  beforeEach(async () => {
    team = createTestTeam('zombie-test');
    const registry = TeamRegistry.getInstance();
    registry.register(team.id, team);

    team.registerRuntime(createMockRuntime(), 'parent');
    team.registerRuntime(createMockRuntime(), 'agent-1');
    team.registerRuntime(createMockRuntime(), 'agent-2');
  });

  afterEach(async () => {
    const registry = TeamRegistry.getInstance();
    await team.dispose();
    registry.unregister(team.id);
  });

  test('should not reclaim when no zombies', () => {
    // Setup: agent-1 assigned task, but lastSeen is recent
    team.tasks = ['t1'];
    team.initialize(team.tasks);
    team.agentLastSeen.set('agent-1', Date.now());

    // Ensure no pendingIndices change
    const pendingBefore = [...getInternal(team).pendingIndices];
    getInternal(team).reclaimZombieAgents();
    const pendingAfter = getInternal(team).pendingIndices;
    expect(pendingAfter).toEqual(pendingBefore);
  });

  test('should reclaim task from zombie agent', async () => {
    team.tasks = ['t1'];
    await team.initialize(team.tasks);
    // Agent-1 claims task
    await team.claimTask('agent-1');
    // Simulate zombie
    team.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);

    // Verify task in progress and assignee
    let status = getInternal(team).taskStatuses.get(0);
    expect(status?.status).toBe('in_progress');
    expect(status?.assignee).toBe('agent-1');

    getInternal(team).reclaimZombieAgents();

    // Agent status reset to idle, lastSeen cleared
    expect(team.agentStatuses.get('agent-1')?.status).toBe('idle');
    expect(team.agentLastSeen.has('agent-1')).toBe(false);

    // Task reset to pending and assignee cleared, retryCount incremented
    status = getInternal(team).taskStatuses.get(0);
    expect(status?.status).toBe('pending');
    expect(status?.assignee).toBeNull();
    expect(status?.retryCount).toBe(1);
    // pendingIndices should contain task index again
    expect(getInternal(team).pendingIndices).toContain(0);
  });

  test('should increment retry count and set retryAvailableAt on reclaim', async () => {
    team.tasks = ['t1'];
    await team.initialize(team.tasks);
    await team.claimTask('agent-1');
    team.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);

    getInternal(team).reclaimZombieAgents();

    const status = getInternal(team).taskStatuses.get(0);
    expect(status?.retryCount).toBe(1);
    expect(status?.retryAvailableAt).toBeGreaterThan(Date.now() - 100);
    expect(status?.retryAvailableAt).toBeLessThanOrEqual(Date.now() + 10000);
  });

  test('should mark task failed when max retries exceeded', async () => {
    team.tasks = ['t1'];
    await team.initialize(team.tasks);
    await team.claimTask('agent-1');
    const task = getInternal(team).taskStatuses.get(0) as any;
    task.retryCount = 3; // set to DEFAULT_MAX_RETRIES

    team.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);

    getInternal(team).reclaimZombieAgents();

    const after = getInternal(team).taskStatuses.get(0);
    expect(after?.status).toBe('failed');
    expect(after?.result).toBe('Agent zombie timeout');
    expect(getInternal(team).pendingIndices).not.toContain(0);
  });

  test('should clear pendingIndices entry when marking failed', async () => {
    team.tasks = ['t1'];
    await team.initialize(team.tasks);
    await team.claimTask('agent-1');
    const status = getInternal(team).taskStatuses.get(0) as any;
    status.retryCount = 3; // set to max before reclaim

    team.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);

    // Ensure pendingIndices contains 0
    getInternal(team).pendingIndices.push(0);

    getInternal(team).reclaimZombieAgents();

    expect(getInternal(team).pendingIndices).not.toContain(0);
  });

  test('should notify update on reclaim', async () => {
    team.tasks = ['t1'];
    await team.initialize(team.tasks);
    await team.claimTask('agent-1');
    team.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);

    const onUpdate = vi.fn();
    // @ts-ignore
    team.onUpdate = onUpdate;
    getInternal(team).reclaimZombieAgents();

    expect(onUpdate).toHaveBeenCalled();
    const update = onUpdate.mock.calls[0][0];
    // update has content array with text
    const text = (update.content[0] as any).text;
    expect(text).toContain('Zombie agent agent-1');
    expect(update.details.agent).toBe('agent-1');
    expect(update.details.taskIndex).toBe(0);
  });

  test('should handle multiple zombies', async () => {
    team.tasks = ['t1', 't2'];
    await team.initialize(team.tasks);
    await team.claimTask('agent-1');
    await team.claimTask('agent-2');
    team.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);
    team.agentLastSeen.set('agent-2', Date.now() - AGENT_TIMEOUT_MS - 1000);

    getInternal(team).reclaimZombieAgents();

    // Both agents should be idle
    expect(team.agentStatuses.get('agent-1')?.status).toBe('idle');
    expect(team.agentStatuses.get('agent-2')?.status).toBe('idle');
    // Both tasks pending
    expect(team.taskStatuses.get(0)?.status).toBe('pending');
    expect(team.taskStatuses.get(1)?.status).toBe('pending');
  });

  test('should only reclaim tasks that are in_progress for the zombie', async () => {
    team.tasks = ['t1', 't2'];
    await team.initialize(team.tasks);
    await team.claimTask('agent-1'); // task0
    await team.claimTask('agent-2'); // task1
    // Mark only agent-1 as zombie, agent-2 remains active
    team.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);
    // agent-2 lastSeen stays recent (set by claimTask)

    getInternal(team).reclaimZombieAgents();

    // task0 should be reclaimed (pending)
    expect(team.taskStatuses.get(0)?.status).toBe('pending');
    // task1 remains in_progress with agent-2
    expect(team.taskStatuses.get(1)?.status).toBe('in_progress');
    expect(team.taskStatuses.get(1)?.assignee).toBe('agent-2');
  });
});
