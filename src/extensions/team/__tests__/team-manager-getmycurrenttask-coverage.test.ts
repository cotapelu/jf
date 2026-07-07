import { AgentTeam } from '../team-manager.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockRuntime } from './test-utils.js';

describe('AgentTeam getMyCurrentTask coverage gaps', () => {
  let team: AgentTeam;
  beforeEach(() => {
    team = new AgentTeam();
    team.id = 'test';
  });
  afterEach(async () => {
    await team.dispose();
  });

  it('should return null for unknown agent (no role mapping)', async () => {
    await team.initialize(['task1']);
    // No runtimes registered; agentId not in roleByAgentId
    const result = await team.getMyCurrentTask('unknown-agent');
    expect(result).toBeNull();
  });

  it('should return null when agent has no current task', async () => {
    await team.initialize(['task1']);
    const rt = createMockRuntime();
    rt.session.sessionId = 'agent-1';
    team.registerRuntime(rt, 'agent-1');
    // Agent hasn't claimed any task yet
    const result = await team.getMyCurrentTask('agent-1');
    expect(result).toBeNull();
  });
});

describe('AgentTeam getTeamStatus edge cases', () => {
  let team: AgentTeam;
  beforeEach(() => {
    team = new AgentTeam();
    team.id = 'test';
  });
  afterEach(async () => {
    await team.dispose();
  });

  it('should return zero counts and isComplete false when no tasks', async () => {
    await team.initialize([]);
    const status = await team.getTeamStatus();
    expect(status.totalTasks).toBe(0);
    expect(status.completedTasks).toBe(0);
    expect(status.failedTasks).toBe(0);
    expect(status.pendingTasks).toBe(0);
    expect(status.isComplete).toBe(false);
  });
});
