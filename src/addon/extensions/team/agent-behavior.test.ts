import { describe, it, expect } from 'vitest';
import { AgentTeam } from './team-manager.js';

describe('AgentTeam branches', () => {
  describe('claimTask', () => {
    it('should return null when no pending tasks', async () => {
      const team = new AgentTeam();
      const result = await team.claimTask('agent-1');
      expect(result).toBeNull();
    });
  });

  describe('getMyCurrentTask', () => {
    it('should return null for agent with no status entry', async () => {
      const team = new AgentTeam();
      expect(await team.getMyCurrentTask('agent-1')).toBeNull();
    });

    it('should return null when agent status has no current task', async () => {
      const team = new AgentTeam();
      team.agentStatuses.set('agent-1', { currentTaskIndex: null, status: 'idle' });
      expect(await team.getMyCurrentTask('agent-1')).toBeNull();
    });
  });

  describe('getTeamStatus', () => {
    it('should report zero tasks when tasks empty', async () => {
      const team = new AgentTeam();
      const status = await team.getTeamStatus();
      expect(status.totalTasks).toBe(0);
      expect(status.completedTasks).toBe(0);
      expect(status.failedTasks).toBe(0);
      expect(status.pendingTasks).toBe(0);
      // isComplete is false when no tasks (total > 0 required)
      expect(status.isComplete).toBe(false);
    });

    it('should report isComplete true when all tasks are done', async () => {
      const team = new AgentTeam();
      // Simulate one completed task
      team.tasks = ['task1'];
      team.taskStatuses.set(0, { assignee: 'agent-1', status: 'completed', result: '', retryCount: 0 });
      const status = await team.getTeamStatus();
      expect(status.totalTasks).toBe(1);
      expect(status.completedTasks).toBe(1);
      expect(status.failedTasks).toBe(0);
      expect(status.pendingTasks).toBe(0);
      expect(status.isComplete).toBe(true);
    });
  });
});
