import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';

// Helper to access private fields for testing
interface AgentTeamInternal {
  agentLastSeen: Map<string, number>;
  taskStatuses: Map<number, any>;
}
function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

describe('AgentTeam Zombie Recovery', () => {
  let team: AgentTeam;
  const AGENT_TIMEOUT_MS = 2 * 60 * 1000; // phải khớp với constant trong code

  beforeEach(async () => {
    team = createTestTeam('test-zombie-team');
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

  test('should reclaim task from zombie agent after timeout', async () => {
    team.tasks = ['task1'];
    await team.initialize(team.tasks);

    // Agent-1 claim task
    await team.claimTask('agent-1');
    let status = await team.getTeamStatus();
    expect(status.tasks[0].status).toBe('in_progress');
    expect(status.tasks[0].assignee).toBe('agent-1');

    // Simulate agent-1 zombie bằng cách set lastSeen cũ
    getInternal(team).agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);

    // Trigger monitor manually (since it runs every 1s)
    // Directly call the monitor logic or setInterval will run later. For test, we'll call directly.
    // We'll access private method? Better: we can set team.monitorInterval và đợi, nhưng chậm.
    // Instead, we'll manually invoke the reclaim logic (extract to method later) or set interval and wait.
    // For simplicity, we can set team.monitorInterval as setInterval and advance time? Không có fake timer.
    // We'll directly call the reclaim function we'll create: `reclaimZombieAgents()` maybe.
    // Actually, trong implementation, monitorInterval gọi getTeamStatus và check isComplete, nhưng không reclaim.
    // Tôi sẽ modify monitorInterval để include zombie check.

    // For now, this test will be updated after implementation.
  });

  test('should increment retry count when reclaiming zombie task', async () => {
    team.tasks = ['task1'];
    await team.initialize(team.tasks);

    await team.claimTask('agent-1');
    const taskBefore = getInternal(team).taskStatuses.get(0);
    expect(taskBefore.retryCount).toBe(0);

    // Simulate zombie
    getInternal(team).agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);

    // Trigger zombie reclaim
    // Sau implementation, có thể gọi team.checkZombieAgents() hoặc monitorInterval tự làm
  });

  test('should clear agent status when reclaimed', async () => {
    team.tasks = ['task1', 'task2'];
    await team.initialize(team.tasks);

    await team.claimTask('agent-1'); // task0
    await team.claimTask('agent-2'); // task1

    // Set both zombies
    getInternal(team).agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1000);
    getInternal(team).agentLastSeen.set('agent-2', Date.now() - AGENT_TIMEOUT_MS - 1000);

    // Trigger reclaim
  });

  test('should not reclaim active agent tasks', async () => {
    team.tasks = ['task1'];
    await team.initialize(team.tasks);

    await team.claimTask('agent-1');
    // agent-1 lastSeen là now (set trong claimTask)
    // Wait? Không cần, lastSeen mới.

    // Trigger zombie check - should not reclaim
  });
});
