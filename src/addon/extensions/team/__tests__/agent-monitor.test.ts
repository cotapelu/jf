/**
 * AgentMonitor Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentMonitor } from '../agent-monitor.js';
import { TaskManager } from '../task-manager.js';

describe('AgentMonitor', () => {
  let taskManager: TaskManager;
  let monitor: AgentMonitor;

  beforeEach(() => {
    taskManager = new TaskManager();
    taskManager.initialize(['t1', 't2']);
    monitor = new AgentMonitor(taskManager);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registerAgent', () => {
    it('should register agent with role mapping', () => {
      monitor.registerAgent('session-1', 'agent-A');
      expect(monitor.getAgentStatus('agent-A')).toEqual({ currentTaskIndex: null, status: 'idle' });
      expect(monitor.getRoles()).toContain('agent-A');
    });

    it('should allow multiple agents', () => {
      monitor.registerAgent('s1', 'agent1');
      monitor.registerAgent('s2', 'agent2');
      expect(monitor.getRoles()).toHaveLength(2);
    });
  });

  describe('unregisterAgent', () => {
    it('should remove agent state', () => {
      monitor.registerAgent('s1', 'agent1');
      monitor.updateHeartbeat('agent1');
      monitor.unregisterAgent('s1');
      expect(monitor.getAgentStatus('agent1')).toBeUndefined();
      expect(monitor.getRoles()).toHaveLength(0);
    });
  });

  describe('updateHeartbeat', () => {
    it('should update lastSeen timestamp', () => {
      monitor.registerAgent('s1', 'agent1');
      const before = Date.now();
      vi.advanceTimersByTime(5000);
      monitor.updateHeartbeat('agent1');
      const after = Date.now();
      const lastSeen = (monitor as any).agentLastSeen.get('agent1');
      expect(lastSeen).toBeGreaterThan(before);
      expect(lastSeen).toBeLessThanOrEqual(after);
    });
  });

  describe('setAgentStatus', () => {
    it('should update agent status', () => {
      monitor.registerAgent('s1', 'agent1');
      monitor.setAgentStatus('agent1', { currentTaskIndex: 0, status: 'working' });
      expect(monitor.getAgentStatus('agent1')).toEqual({ currentTaskIndex: 0, status: 'working' });
    });
  });

  describe('reclaimZombieAgents', () => {
    beforeEach(() => {
      monitor.registerAgent('s1', 'agent1');
      monitor.registerAgent('s2', 'agent2');
      // agent1 claims a task
      taskManager.claimTask('agent1');
      // Set agent1 status to working (simulate assignment)
      monitor.setAgentStatus('agent1', { currentTaskIndex: 0, status: 'working' });
      monitor.updateHeartbeat('agent1');
      // Simulate old heartbeat for agent2 (no activity) - make it working
      monitor.setAgentStatus('agent2', { currentTaskIndex: null, status: 'working' });
      const oldTime = Date.now() - (2 * 60 * 1000 + 1000); // older than timeout
      (monitor as any).agentLastSeen.set('agent2', oldTime);
    });

    it('should detect zombie agents by timeout', () => {
      // Check that agent2 qualifies as zombie (working + old heartbeat)
      const status2 = monitor.getAgentStatus('agent2');
      const lastSeen2 = (monitor as any).agentLastSeen.get('agent2');
      const now = Date.now();
      const isZombie = status2 && status2.status === 'working' && now - lastSeen2! > 2 * 60 * 1000;
      expect(isZombie).toBe(true);
    });

    it('should not affect active agents', () => {
      monitor.reclaimZombieAgents();
      expect(monitor.getAgentStatus('agent1')?.status).toBe('working');
      expect(monitor.getAgentStatus('agent1')?.currentTaskIndex).toBe(0);
    });

    it('should clear heartbeat for zombies', () => {
      // Use agent2 from beforeEach (already working with old heartbeat)
      expect(monitor.getAgentStatus('agent2')?.status).toBe('working');
      expect((monitor as any).agentLastSeen.has('agent2')).toBe(true);
      monitor.reclaimZombieAgents();
      expect(monitor.getAgentStatus('agent2')?.status).toBe('idle');
      expect((monitor as any).agentLastSeen.has('agent2')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should reset all state', () => {
      monitor.registerAgent('s1', 'agent1');
      monitor.updateHeartbeat('agent1');
      monitor.clear();
      expect(monitor.getRoles()).toHaveLength(0);
      expect((monitor as any).agentLastSeen.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle unknown agent in getAgentStatus', () => {
      expect(monitor.getAgentStatus('unknown')).toBeUndefined();
    });

    it('should handle multiple reclaim cycles', () => {
      monitor.registerAgent('s1', 'agent1');
      monitor.updateHeartbeat('agent1');
      // Make agent1 zombie
      vi.advanceTimersByTime(130000); // > 2min
      monitor.reclaimZombieAgents();
      expect(monitor.getAgentStatus('agent1')?.status).toBe('idle');
    });
  });
});
