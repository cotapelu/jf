/**
 * Behavioral tests for AgentTeam covering uncovered methods and edge cases.
 */

import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRuntime, createTestTeam } from './test-utils.js';

// Helper to access private fields/methods for testing
interface AgentTeamInternal {
  agentLastSeen: Map<string, number>;
  workspaceClear: () => void;
  getBootstrapPrompt: (role: string) => Promise<string>;
  getContinuationPrompt: (turn: number) => Promise<string>;
}
function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

describe('AgentTeam Behaviors', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = createTestTeam('test-behaviors');
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

  describe('setupChildRuntimes', () => {
    it('should throw if no roles defined', async () => {
      const emptyTeam = new AgentTeam();
      await emptyTeam.initialize(['task']);
      const mockParent = createMockRuntime();
      await expect(emptyTeam.setupChildRuntimes(mockParent)).rejects.toThrow('No agent roles defined');
    });
  });

  describe('updateHeartbeat', () => {
    it('should update last seen timestamp for role', async () => {
      await team.initialize([]);
      team.updateHeartbeat('agent-1');
      const seen = getInternal(team).agentLastSeen.get('agent-1');
      expect(seen).toBeGreaterThanOrEqual(Date.now() - 100);
    });
  });

  describe('getTeamStatus', () => {
    it('should return correct structure with no tasks', async () => {
      await team.initialize([]);
      const status = await team.getTeamStatus();
      expect(status.totalTasks).toBe(0);
      expect(status.completedTasks).toBe(0);
      expect(status.tasks).toEqual([]);
    });

    it('should reflect task assignments', async () => {
      await team.initialize(['A', 'B']);
      await team.claimTask('agent-1');
      const status = await team.getTeamStatus();
      expect(status.tasks[0].status).toBe('in_progress');
      expect(status.tasks[0].assignee).toBe('agent-1');
    });
  });

  describe('message bus', () => {
    it('should store and retrieve messages', async () => {
      await team.initialize([]);
      await team.publishMessage('chan', 'agent-1', 'hello');
      const msgs = await team.getMessages('chan');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe('hello');
      expect(msgs[0].from).toBe('agent-1');
    });

    it('should limit messages', async () => {
      await team.initialize([]);
      for (let i = 0; i < 10; i++) {
        await team.publishMessage('chan', `agent-${i%2}`, `msg${i}`);
      }
      const msgs = await team.getMessages('chan', 5);
      expect(msgs).toHaveLength(5);
    });
  });

  describe('workspace operations', () => {
    it('should clear all workspace data', async () => {
      await team.initialize([]);
      team.getWorkspace().set('k1', 'v1', 'agent-1');
      team.getWorkspace().set('k2', 'v2', 'agent-2');
      expect(team.getWorkspace().list()).toHaveLength(2);
      await getInternal(team).workspaceClear();
      expect(team.getWorkspace().list()).toHaveLength(0);
    });

    it('should delete workspace key', async () => {
      await team.initialize([]);
      team.getWorkspace().set('key', 'value', 'agent-1');
      expect(team.getWorkspace().get('key')).toBe('value');
      await team.workspaceDelete('key');
      expect(team.getWorkspace().get('key')).toBeUndefined();
    });
  });

  describe('heartbeat', () => {
    it('should track last seen for registered agents', () => {
      team.agentStatuses.set('agent-1', { currentTaskIndex: null, status: 'idle' });
      team.updateHeartbeat('agent-1');
      const seen = getInternal(team).agentLastSeen.get('agent-1');
      expect(seen).toBeDefined();
    });
  });

  describe('prompt generation', () => {
    it('should generate bootstrap prompt with tasks', async () => {
      await team.initialize(['Do X', 'Do Y']);
      const prompt = await getInternal(team).getBootstrapPrompt('coder');
      expect(prompt).toContain('Do X');
      expect(prompt).toContain('Do Y');
      expect(prompt).toContain('coder');
    });

    it('should generate continuation prompt with recent messages', async () => {
      await team.initialize(['Task']);
      await team.publishMessage('team.chat', 'agent-1', 'First message');
      const prompt = await getInternal(team).getContinuationPrompt(1);
      expect(prompt).toContain('Turn 2');
      expect(prompt).toContain('First message');
    });
  });
});
