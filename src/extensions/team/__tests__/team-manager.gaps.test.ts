import { AgentTeam, TeamRegistry } from '../team-manager.js';
import { TaskManager } from '../task-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRuntime } from './test-utils.js';

describe('AgentTeam uncovered branches', () => {
  let team: AgentTeam;

  afterEach(async () => {
    if (team) await team.dispose();
  });

  describe('handleAgentFailure early-return cases', () => {
    it('should return false and do nothing when task index does not exist', async () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);

      // Call handleAgentFailure with an index that doesn't correspond to any task
      await (team as any).handleAgentFailure('agent-1', 999, new Error('fail'));

      // Verify no state change: task still pending, no assignee change
      const status = team.taskStatuses.get(0);
      expect(status?.status).toBe('pending');
      expect(status?.assignee).toBeNull();
    });

    it('should return false when agent is not the assignee', async () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const rt1 = createMockRuntime(); rt1.session.sessionId = 'agent-1'; team.registerRuntime(rt1, 'agent-1');
      const rt2 = createMockRuntime(); rt2.session.sessionId = 'agent-2'; team.registerRuntime(rt2, 'agent-2');
      await team.initialize(['task0']);
      await team.claimTask('agent-1');
      await (team as any).handleAgentFailure('agent-2', 0, new Error('fail'));
      const teamAny = team as any;
      const task = teamAny.taskManager.getTaskStatus(0);
      expect(task.assignee).toBe('agent-1');
      expect(task.status).toBe('in_progress');
    });
  });

  describe('TeamRegistry edge cases', () => {
    it('unregister on non-existent team should not throw', () => {
      const registry = TeamRegistry.getInstance();
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });

    it('resetAutoDisposeTimer on non-existent team should be no-op', () => {
      const registry = TeamRegistry.getInstance();
      expect(() => registry.resetAutoDisposeTimer('non-existent')).not.toThrow();
    });

    it('autoDisposeTeam should catch errors from team.dispose', async () => {
      const registry = TeamRegistry.getInstance();

      // Create a fake team with dispose that throws
      const fakeTeam = {
        dispose: vi.fn().mockRejectedValue(new Error('dispose fail')),
      } as any;

      // Manually inject into registry
      (registry as any).teams.set('fake-team', fakeTeam);

      // Call autoDisposeTeam (should catch and not rethrow)
      await (registry as any).autoDisposeTeam('fake-team');

      // Since dispose failed, team should remain in registry (unregister not called)
      expect((registry as any).teams.has('fake-team')).toBe(true);
    });
  });

  describe('reportResult edge cases', () => {
    it('should not throw when agent status is missing', async () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);
      // Claim task for agent-1 (assignee set)
      await team.claimTask('agent-1');
      // Do NOT call completeTask; so agentStatuses does not have entry for 'agent-1'
      // Call reportResult directly – should not throw even if status missing
      await (team as any).reportResult(0, 'result');
      // Verify task marked completed in taskManager
      const task = (team as any).taskManager.getTaskStatus(0);
      expect(task.status).toBe('completed');
    });
  });

  describe('waitForCompletion edge cases', () => {
    it('should poll and wait until tasks complete', async () => {
      vi.useFakeTimers();
      team = new AgentTeam();
      team.setTeamId('test');
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      await team.initialize(['task0']);
      const waitPromise = (team as any).waitForCompletion();
      await team.claimTask('agent-1');
      vi.advanceTimersByTime(300);
      await team.completeTask('agent-1', 0, 'done');
      vi.advanceTimersByTime(200);
      await waitPromise;
      vi.useRealTimers();
    });
  });

  describe('startAgentLoops branch', () => {
    it('should not start loop for roles without matching runtime', () => {
      team = new AgentTeam();
      team.setTeamId('test');
      // Manually inject a role without a runtime
      (team as any).roles = ['agent-1'];
      (team as any).runtimes = [];
      const spy = vi.spyOn(team as any, 'runAgentLoop');
      (team as any).startAgentLoops();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('shouldTerminate branches', () => {
    it('should return true when all tasks completed', () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const notifySpy = vi.spyOn(team as any, 'notifyUpdate');
      const result = (team as any).shouldTerminate('agent-1', { completedTasks: 2, totalTasks: 2 }, 0, 50);
      expect(result).toBe(true);
      expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.objectContaining({ status: 'finished' })
      }));
    });

    it('should return true when max turns reached', () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const notifySpy = vi.spyOn(team as any, 'notifyUpdate');
      const result = (team as any).shouldTerminate('agent-1', { completedTasks: 0, totalTasks: 2 }, 50, 50);
      expect(result).toBe(true);
      expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.objectContaining({ status: 'max_turns' })
      }));
    });

    it('should return false otherwise', () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const notifySpy = vi.spyOn(team as any, 'notifyUpdate');
      const result = (team as any).shouldTerminate('agent-1', { completedTasks: 0, totalTasks: 2 }, 0, 50);
      expect(result).toBe(false);
      expect(notifySpy).not.toHaveBeenCalled();
    });
  });

  describe('executeAgentPrompt ternary branches', () => {
    it('should call getBootstrapPrompt when turnCount is 0', async () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      const bootstrapSpy = vi.spyOn(team as any, 'getBootstrapPrompt');
      const contSpy = vi.spyOn(team as any, 'getContinuationPrompt');
      await (team as any).executeAgentPrompt('agent-1', rt, 0);
      expect(bootstrapSpy).toHaveBeenCalledWith('agent-1');
      expect(contSpy).not.toHaveBeenCalled();
    });

    it('should call getContinuationPrompt when turnCount > 0', async () => {
      team = new AgentTeam();
      team.setTeamId('test');
      const rt = createMockRuntime();
      rt.session.sessionId = 'agent-1';
      team.registerRuntime(rt, 'agent-1');
      const bootstrapSpy = vi.spyOn(team as any, 'getBootstrapPrompt');
      const contSpy = vi.spyOn(team as any, 'getContinuationPrompt');
      (team as any).executeAgentPrompt('agent-1', rt, 1);
      expect(contSpy).toHaveBeenCalledWith(1);
      expect(bootstrapSpy).not.toHaveBeenCalled();
    });
  });

  describe('TaskManager.handleRetryExceeded error formatting', () => {
    it('should format error message correctly for Error, string, null, undefined', () => {
      const tm = new TaskManager();
      tm.initialize(['t']);
      const tmAny = tm as any;
      const task: any = { status: 'in_progress', result: '', retryCount: 3, retryAvailableAt: undefined };
      tmAny.taskStatuses.set(0, task);

      // Null
      tmAny.handleRetryExceeded(task, 'agent', 0, null);
      expect(task.result).toBe('Unknown error');

      // Undefined
      task.result = '';
      tmAny.handleRetryExceeded(task, 'agent', 0, undefined);
      expect(task.result).toBe('Unknown error');

      // String
      task.result = '';
      tmAny.handleRetryExceeded(task, 'agent', 0, 'custom error');
      expect(task.result).toBe('custom error');

      // Error object
      task.result = '';
      tmAny.handleRetryExceeded(task, 'agent', 0, new Error('obj error'));
      expect(task.result).toBe('obj error');
    });
  });
});
