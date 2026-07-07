/**
 * Additional coverage tests for AgentTeam to push statement coverage higher.
 */

import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';

// Helper to access private methods for testing
interface AgentTeamInternal {
  handleAgentEvent: (agentId: string, event: any) => Promise<void>;
}
function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

describe('AgentTeam Coverage', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = createTestTeam('test-coverage');
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

  describe('initialize', () => {
    it('should clear previous state', async () => {
      await team.initialize(['A']);
      expect(team.tasks).toHaveLength(1);
      // Re-initialize with different tasks
      await team.initialize(['B', 'C']);
      expect(team.tasks).toEqual(['B', 'C']);
      const status = await team.getTeamStatus();
      expect(status.totalTasks).toBe(2);
    });
  });

  describe('getMyCurrentTask', () => {
    it('should return null for unknown agent', async () => {
      await team.initialize(['task']);
      const task = await team.getMyCurrentTask('unknown-agent');
      expect(task).toBeNull();
    });
  });

  describe('workspace operations', () => {
    it('should read undefined for missing key', async () => {
      await team.initialize([]);
      const val = await team.workspaceRead('missing');
      expect(val).toBeUndefined();
    });

    it('should delete existing key', async () => {
      await team.initialize([]);
      team.getWorkspace().set('key', 'value', 'agent-1');
      expect(await team.workspaceRead('key')).toBe('value');
      await team.workspaceDelete('key');
      expect(await team.workspaceRead('key')).toBeUndefined();
    });

    it('workspaceToObject should return plain object', async () => {
      await team.initialize([]);
      team.getWorkspace().set('a', 1, 'agent-1');
      team.getWorkspace().set('b', 2, 'agent-2');
      const obj = await team.workspaceToObject();
      expect(obj).toEqual({ a: 1, b: 2 });
    });
  });

  describe('message bus', () => {
    it('should return empty list for unknown channel', async () => {
      await team.initialize([]);
      const msgs = await team.getMessages('unknown');
      expect(msgs).toHaveLength(0);
    });

    it('should limit messages to last N', async () => {
      await team.initialize([]);
      for (let i = 0; i < 20; i++) {
        await team.publishMessage('chan', `agent-${i%2}`, `msg${i}`);
      }
      const msgs = await team.getMessages('chan', 5);
      expect(msgs).toHaveLength(5);
      // The slice(-N) returns last N in order, so first is msg15 (index 15)
      expect(msgs[0].content).toBe('msg15');
      expect(msgs[4].content).toBe('msg19');
    });
  });

  describe('agent status', () => {
    it('should mark agent idle after initialize', async () => {
      await team.initialize([]);
      const status = team.agentStatuses.get('agent-1');
      expect(status?.status).toBe('idle');
      expect(status?.currentTaskIndex).toBeNull();
    });
  });

  describe('getTeamStatus', () => {
    it('should reflect tasks with no assignments', async () => {
      await team.initialize(['T1', 'T2']);
      const status = await team.getTeamStatus();
      expect(status.totalTasks).toBe(2);
      expect(status.completedTasks).toBe(0);
      expect(status.tasks.every(t => t.status === 'pending')).toBe(true);
    });

    it('should include assignee after claim', async () => {
      await team.initialize(['T']);
      await team.claimTask('agent-1');
      const status = await team.getTeamStatus();
      expect(status.tasks[0].assignee).toBe('agent-1');
    });
  });

  describe('handleAgentEvent', () => {
    it('should generate update on agent_start', async () => {
      await team.initialize(['task']);
      const updates: any[] = [];
      team.setOnUpdate(u => updates.push(u));
      // @ts-ignore - calling internal method with mock event
      await getInternal(team).handleAgentEvent('agent-1', { type: 'agent_start' });
      expect(updates.some(u => u.content.some((c: any) => c.text.includes('Agent started')))).toBe(true);
    });

    it('should generate update on tool_execution_end', async () => {
      await team.initialize(['task']);
      const updates: any[] = [];
      team.setOnUpdate(u => updates.push(u));
      // @ts-ignore - calling internal method with mock event
      await getInternal(team).handleAgentEvent('agent-1', { type: 'tool_execution_end', toolName: 'read' });
      expect(updates.some(u => u.content.some((c: any) => c.text.includes('Tool read done')))).toBe(true);
    });
  });

  describe('shouldTerminate (private)', () => {
    it('should return true when all tasks completed', async () => {
      await team.initialize(['T1', 'T2']);
      const priv = team as any;
      const status = { completedTasks: 2, totalTasks: 2 };
      expect(priv.shouldTerminate('agent-1', status, 5, 50)).toBe(true);
    });

    it('should return true when turnCount reaches max', async () => {
      const priv = team as any;
      const status = { completedTasks: 0, totalTasks: 1 };
      expect(priv.shouldTerminate('agent-1', status, 50, 50)).toBe(true);
    });

    it('should return false otherwise', async () => {
      const priv = team as any;
      const status = { completedTasks: 0, totalTasks: 2 };
      expect(priv.shouldTerminate('agent-1', status, 10, 50)).toBe(false);
    });
  });

  describe('executeAgentPrompt error handling', () => {
    it('should catch errors from session.prompt and notify', async () => {
      await team.initialize(['task']);
      const mockRuntime = createMockRuntime();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const updates: any[] = [];
      team.setOnUpdate(u => updates.push(u));
      // Mock session.prompt to reject
      mockRuntime.session.prompt = vi.fn().mockRejectedValue(new Error('prompt failure'));
      team.registerRuntime(mockRuntime, 'agent-1');
      const priv = team as any;
      await priv.executeAgentPrompt('agent-1', mockRuntime, 0);
      // Should have produced an error update
      expect(updates.some(u => u.isError && u.content.some((c: any) => c.text.includes('Agent agent-1 error')))).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('handleAgentEvent additional cases', () => {
    it('should handle agent_end event', async () => {
      await team.initialize(['task']);
      const updates: any[] = [];
      team.setOnUpdate(u => updates.push(u));
      const priv = getInternal(team);
      await priv.handleAgentEvent('agent-1', { type: 'agent_end', stopReason: 'completed' });
      expect(updates.some(u => u.content.some((c: any) => c.text.includes('finished')))).toBe(true);
    });

    it('should handle message_start event', async () => {
      await team.initialize(['task']);
      const updates: any[] = [];
      team.setOnUpdate(u => updates.push(u));
      const priv = getInternal(team);
      await priv.handleAgentEvent('agent-1', { type: 'message_start', message: { role: 'user', content: 'hello' } });
      expect(updates.some(u => u.content.some((c: any) => c.text.includes('User:')))).toBe(true);
    });

    it('should ignore message_update event', async () => {
      await team.initialize(['task']);
      const updates: any[] = [];
      team.setOnUpdate(u => updates.push(u));
      const priv = getInternal(team);
      await priv.handleAgentEvent('agent-1', { type: 'message_update' });
      expect(updates.length).toBe(0);
    });
  });
});
