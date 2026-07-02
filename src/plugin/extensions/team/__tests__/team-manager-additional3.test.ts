#!/usr/bin/env node
/**
 * Additional branch coverage tests for team-manager (Round 205+)
 * Targeting uncovered branches identified in AGENT_METRICS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';

function asAny<T>(x: T): any { return x; }

describe('AgentTeam Branch Coverage (Round 205)', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('branch-cov-team');
    const parent = createMockRuntime();
    parent.session.sessionId = 'parent-session';
    team.registerRuntime(parent, 'parent');
    const agent = createMockRuntime();
    agent.session.sessionId = 'agent-session';
    team.registerRuntime(agent, 'agent');
  });

  afterEach(async () => {
    if (team) await team.dispose();
  });

  describe('handleAgentFailure edge cases', () => {
    it('should handle string error (else-if branch)', async () => {
      await team.initialize(['task1']);
      await team.claimTask('agent');
      // Directly manipulate retryCount to near max to trigger failure quickly
      const internal = asAny(team);
      const taskIdx = 0;
      const task = internal.taskStatuses.get(taskIdx);
      // Pretend retryCount is at threshold - 1
      task.retryCount = 2; // DEFAULT_MAX_RETRIES is 3, so after increment becomes 3
      await team.handleAgentFailure('agent', taskIdx, 'string error');
      expect(task.status).toBe('failed');
      expect(task.result).toBe('string error');
      expect(internal.pendingIndices).not.toContain(taskIdx);
    });

    it('should handle undefined error (else branch)', async () => {
      await team.initialize(['task1']);
      await team.claimTask('agent');
      const internal = asAny(team);
      const taskIdx = 0;
      const task = internal.taskStatuses.get(taskIdx);
      task.retryCount = 2;
      await team.handleAgentFailure('agent', taskIdx, undefined);
      expect(task.status).toBe('failed');
      expect(task.result).toBe('Unknown error');
    });

    it('should handle null error (else branch)', async () => {
      await team.initialize(['task1']);
      await team.claimTask('agent');
      const internal = asAny(team);
      const taskIdx = 0;
      const task = internal.taskStatuses.get(taskIdx);
      task.retryCount = 2;
      await team.handleAgentFailure('agent', taskIdx, null);
      expect(task.status).toBe('failed');
      expect(task.result).toBe('Unknown error');
    });

    it('should no-op when task not assigned to agent', async () => {
      await team.initialize(['task1']);
      const internal = asAny(team);
      // Don't claim; task remains pending with assignee null
      await team.handleAgentFailure('agent', 0, new Error('fail'));
      const task = internal.taskStatuses.get(0);
      // Should remain pending and no retry increment
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(0);
    });

    it('should no-op when task does not exist', async () => {
      await team.initialize(['task1']);
      // There is only task index 0; call with index 99
      await team.handleAgentFailure('agent', 99, new Error('fail'));
      // No exception thrown
    });
  });

  describe('handleAgentFailure retry path', () => {
    it('should retry with backoff when retries remaining', async () => {
      await team.initialize(['task1']);
      await team.claimTask('agent');
      const internal = asAny(team);
      const taskIdx = 0;
      const task = internal.taskStatuses.get(taskIdx);
      task.retryCount = 0; // will become 1
      await team.handleAgentFailure('agent', taskIdx, new Error('fail'));
      expect(task.status).toBe('pending');
      expect(task.assignee).toBeNull();
      expect(task.retryCount).toBe(1);
      expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
      expect(internal.pendingIndices).toContain(taskIdx);
    });
  });

  describe('reclaimZombieAgents edge cases', () => {
    it('should reclaim zombie and mark task as failed after max retries', async () => {
      await team.initialize(['task1']);
      await team.claimTask('agent');
      const internal = asAny(team);
      const taskIdx = 0;
      const task = internal.taskStatuses.get(taskIdx);
      task.retryCount = 2; // on reclaim, becomes 3 -> fail
      internal.agentLastSeen.set('agent', Date.now() - 3 * 60 * 1000); // > AGENT_TIMEOUT_MS
      internal.reclaimZombieAgents();
      expect(task.status).toBe('failed');
      expect(task.assignee).toBeNull();
      expect(internal.pendingIndices).not.toContain(taskIdx);
      const agentStatus = internal.agentStatuses.get('agent');
      expect(agentStatus.status).toBe('idle');
    });

    it('should reclaim zombie and re-queue task when retries remain', async () => {
      await team.initialize(['task1']);
      await team.claimTask('agent');
      const internal = asAny(team);
      const taskIdx = 0;
      const task = internal.taskStatuses.get(taskIdx);
      task.retryCount = 0; // after reclaim becomes 1
      internal.agentLastSeen.set('agent', Date.now() - 3 * 60 * 1000);
      internal.reclaimZombieAgents();
      expect(task.status).toBe('pending');
      expect(task.assignee).toBeNull();
      expect(task.retryCount).toBe(1);
      expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
      expect(internal.pendingIndices).toContain(taskIdx);
    });

    it('should do nothing if agent is not working', async () => {
      await team.initialize(['task1']);
      // Do not claim; agent status remains idle
      const internal = asAny(team);
      internal.agentLastSeen.set('agent', Date.now() - 3 * 60 * 1000);
      const spy = vi.spyOn(internal, 'insertPendingIndexSorted');
      internal.reclaimZombieAgents();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('claimTask edge cases', () => {
    it('should return null when no pending tasks', async () => {
      await team.initialize(['task1']);
      // Immediately claim should get the task
      const idx1 = await team.claimTask('agent');
      expect(idx1).toBe(0);
      // Claim again - no pending tasks left
      const idx2 = await team.claimTask('agent');
      expect(idx2).toBeNull();
    });

    it('should skip task with retryAvailableAt in future', async () => {
      await team.initialize(['task1', 'task2']);
      // Claim task0
      await team.claimTask('agent');
      const internal = asAny(team);
      // Simulate that task0 is backoff by setting retryAvailableAt far in future
      const task0 = internal.taskStatuses.get(0);
      task0.status = 'pending';
      task0.assignee = null;
      task0.retryAvailableAt = Date.now() + 60_000;
      // pendingIndices currently contains [0,1] maybe after release? Actually after claim task0, pendingIndices is [1]? We need to have both pending. Let's reinitialize.
      internal.pendingIndices = [0, 1]; // both pending for test
      const idx = await team.claimTask('agent');
      // Should claim task1 (index 1) because task0 is in backoff
      expect(idx).toBe(1);
    });
  });

  describe('getMyCurrentTask', () => {
    it('should return null for unknown agent', async () => {
      await team.initialize(['task1']);
      const idx = await team.getMyCurrentTask('nonexistent');
      expect(idx).toBeNull();
    });
  });

  describe('releaseTask edge cases', () => {
    it('should return false if task not assigned to agent', async () => {
      await team.initialize(['task']);
      // Task is pending, not assigned
      const released = await team.releaseTask('agent', 0);
      expect(released).toBe(false);
    });

    it('should return false if task already completed', async () => {
      await team.initialize(['task']);
      await team.claimTask('agent');
      const internal = asAny(team);
      // Mark task completed without using completeTask to bypass checks
      const task = internal.taskStatuses.get(0);
      task.status = 'completed';
      task.assignee = 'agent';
      const released = await team.releaseTask('agent', 0);
      expect(released).toBe(false);
    });
  });

  describe('completeTask mismatch', () => {
    it('should no-op if task not assigned to caller', async () => {
      await team.initialize(['task']);
      await team.claimTask('agent');
      // Now try to complete with different agentId
      await team.completeTask('other-agent', 0, 'result');
      const internal = asAny(team);
      const task = internal.taskStatuses.get(0);
      expect(task.status).not.toBe('completed');
    });
  });

  describe('handleAgentEvent & extractText', () => {
    it('should ignore event that is not an object', () => {
      const internal = asAny(team);
      // @ts-ignore - call private
      internal.handleAgentEvent('agent', 'not an object');
      // No crash, no update
    });

    it('should ignore event without type property', () => {
      const internal = asAny(team);
      // @ts-ignore - call private
      internal.handleAgentEvent('agent', { foo: 'bar' });
      // No update
    });

    it('should handle message_start with content as string', () => {
      const notify = vi.fn();
      team.setOnUpdate(notify);
      const internal = asAny(team);
      const event = { type: 'message_start' as const, message: { role: 'user', content: 'Hello world' } };
      // @ts-ignore
      internal.handleAgentEvent('agent', event);
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        content: [{ type: 'text', text: '[agent] User: Hello world' }]
      }));
    });

    it('should handle message_start with content array', () => {
      const notify = vi.fn();
      team.setOnUpdate(notify);
      const internal = asAny(team);
      const event = { type: 'message_start' as const, message: { role: 'assistant', content: [{ type: 'text', text: 'Hi' }, { type: 'text', text: ' there' }] } };
      // @ts-ignore
      internal.handleAgentEvent('agent', event);
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        content: [{ type: 'text', text: '[agent] Assistant: Hi there' }]
      }));
    });

    it('should handle message_start with no content', () => {
      const notify = vi.fn();
      team.setOnUpdate(notify);
      const internal = asAny(team);
      const event = { type: 'message_start' as const, message: { role: 'user' } };
      // @ts-ignore
      internal.handleAgentEvent('agent', event);
      // text should be empty after colon
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        content: [{ type: 'text', text: expect.stringMatching(/\[agent\] User: $/) }]
      }));
    });

    it('should handle unknown event type without creating text', () => {
      const notify = vi.fn();
      team.setOnUpdate(notify);
      const internal = asAny(team);
      const event = { type: 'unknown_type' as const };
      // @ts-ignore
      internal.handleAgentEvent('agent', event);
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe('extractText variations', () => {
    it('should extract from content as string', () => {
      // @ts-ignore - private method call
      const text = team['extractText']({ content: 'plain string' });
      expect(text).toBe('plain string');
    });

    it('should extract from content array with text parts', () => {
      // @ts-ignore
      const text = team['extractText']({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }, { type: 'image' }] });
      expect(text).toBe('ab');
    });

    it('should return empty when content array has no text', () => {
      // @ts-ignore
      const text = team['extractText']({ content: [{ type: 'image' }, { type: 'tool_call' }] });
      expect(text).toBe('');
    });

    it('should return empty when message is null', () => {
      // @ts-ignore
      const text = team['extractText'](null);
      expect(text).toBe('');
    });
  });

  describe('TeamRegistry edge cases', () => {
    it('waitForTeam should throw when team not found', async () => {
      const registry = TeamRegistry.getInstance();
      await expect(registry.waitForTeam('unknown')).rejects.toThrow('Team unknown not found');
    });

    it('getTeamStatus should return null for unknown team', async () => {
      const registry = TeamRegistry.getInstance();
      const status = await registry.getTeamStatus('unknown');
      expect(status).toBeNull();
    });

    it('resetAutoDisposeTimer should handle when team is null', () => {
      const registry = TeamRegistry.getInstance();
      // Should not throw; no team
      registry.resetAutoDisposeTimer('missing');
      // No error is success
    });
  });

  describe('startAgentLoops missing runtime', () => {
    it('should skip roles without corresponding runtime', () => {
      const internal = asAny(team);
      // Add a role that does not have a runtime
      internal.roles.push('ghost-agent');
      // startAgentLoops should not throw and should not set controller for ghost-agent
      expect(() => team.startAgentLoops()).not.toThrow();
      const controllers = internal.childControllers;
      expect(controllers.has('ghost-agent')).toBe(false);
      // Cleanup any loops started
      internal.childControllers.forEach(ctrl => ctrl.abort());
      internal.childPromises.forEach(p => p.catch(() => {}));
    });
  });
});
