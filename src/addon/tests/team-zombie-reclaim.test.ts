import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTeam } from '../extensions/team/team-manager.js';

// Helper to access private reclaimZombieAgents method
async function reclaimZombieAgents(team: AgentTeam): Promise<void> {
  return (team as unknown as { reclaimZombieAgents(): Promise<void> }).reclaimZombieAgents();
}

// Mock TeamRegistry
vi.mock('../extensions/team/team-manager.js', async () => {
  const actual = await vi.importActual('../extensions/team/team-manager.js');
  return {
    ...actual,
    TeamRegistry: {
      getInstance: vi.fn(() => ({
        register: vi.fn(),
        unregister: vi.fn(),
        get: vi.fn(),
        resetAutoDisposeTimer: vi.fn(),
      })),
    },
  };
});

describe('AgentTeam Zombie Reclamation', () => {
  let team: AgentTeam;

  function setAgent(role: string, idx: number | null, status: string, lastSeen: number) {
    team.agentStatuses.set(role, { currentTaskIndex: idx, status });
    team.agentLastSeen.set(role, lastSeen);
  }

  function setTask(idx: number, status: 'pending' | 'in_progress' | 'completed' | 'failed', assignee: string | null = null) {
    team.taskStatuses.set(idx, { assignee, status, result: '', retryCount: 0 });
    if (status === 'pending') {
      team.pendingIndices.push(idx);
      team.pendingIndices.sort((a,b)=>a-b);
    }
  }

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('team-123');
    team.setOnUpdate(() => {});
    team.tasks = ['task0', 'task1'];
    team.pendingIndices = [];
    team.taskStatuses.clear();
    team.agentStatuses.clear();
    team.agentLastSeen.clear();
  });

  it('should reclaim zombie agent and release task', async () => {
    // Setup: agent working on task 0
    setTask(0, 'in_progress', 'agent1');
    setAgent('agent1', 0, 'working', Date.now() - 2 * 60 * 1000 - 1); // older than AGENT_TIMEOUT_MS (2min)

    // Call reclaim
    await reclaimZombieAgents(team);

    // Expect task 0 becomes pending and agent idle
    expect(team.taskStatuses.get(0)?.status).toBe('pending');
    expect(team.taskStatuses.get(0)?.assignee).toBeNull();
    expect(team.agentStatuses.get('agent1')?.status).toBe('idle');
    expect(team.agentStatuses.get('agent1')?.currentTaskIndex).toBeNull();
    // task index should be back in pendingIndices
    expect(team.pendingIndices).toContain(0);
  });

  it('should not reclaim active agent', async () => {
    setTask(0, 'in_progress', 'agent1');
    setAgent('agent1', 0, 'working', Date.now() - 30 * 1000); // recent

    await reclaimZombieAgents(team);

    expect(team.taskStatuses.get(0)?.status).toBe('in_progress');
    expect(team.agentStatuses.get('agent1')?.status).toBe('working');
  });

  it('should ignore agent not working', async () => {
    setTask(0, 'in_progress', 'agent1');
    setAgent('agent1', 0, 'idle', Date.now() - 10000000); // old but idle

    await reclaimZombieAgents(team);

    expect(team.taskStatuses.get(0)?.status).toBe('in_progress');
  });

  it('should mark task failed after max retries', async () => {
    const maxRetries = 3; // DEFAULT_MAX_RETRIES = 3
    // Task with retryCount already max-1
    setTask(0, 'in_progress', 'agent1');
    const task = team.taskStatuses.get(0)!;
    task.retryCount = maxRetries - 1; // will become max on reclaim
    setAgent('agent1', 0, 'working', Date.now() - 10000000); // very old

    await reclaimZombieAgents(team);

    expect(team.taskStatuses.get(0)?.status).toBe('failed');
    expect(team.taskStatuses.get(0)?.result).toBe('Agent zombie timeout');
    // agent should be idle and removed from lastSeen
    expect(team.agentStatuses.get('agent1')?.status).toBe('idle');
    expect(team.agentLastSeen.has('agent1')).toBe(false);
  });
});
