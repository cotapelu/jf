#!/usr/bin/env node
/**
 * Additional branch coverage tests for team-manager (Round 207+)
 * Targeting uncovered arcs identified in coverage report.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentTeam, TeamRegistry, bootPiclawTeam } from '../team-manager.js';
import { createMockRuntime } from './test-utils.js';

// Helper to access private methods
function asAny<T>(x: T): any { return x; }

// ==================== TeamRegistry.waitForTeam ====================
describe('TeamRegistry.waitForTeam (branch coverage)', () => {
  let registry: TeamRegistry;
  const registeredIds: string[] = [];

  beforeEach(() => {
    registry = TeamRegistry.getInstance();
    registeredIds.length = 0;
  });

  afterEach(() => {
    // Unregister only teams we registered to avoid affecting other tests
    for (const id of registeredIds) {
      try { registry.unregister(id); } catch {}
    }
  });

  it('should return true when team is already complete', async () => {
    const mockTeam = {
      getTeamStatus: vi.fn().mockResolvedValue({
        completedTasks: 2,
        totalTasks: 2,
        isComplete: true,
        agents: [],
        tasks: [],
      }),
    };
    const teamId = 'team1';
    (registry as any).teams.set(teamId, mockTeam);
    registeredIds.push(teamId);
    const result = await registry.waitForTeam(teamId);
    expect(result).toBe(true);
  });

  it('should return false on timeout before completion', async () => {
    const mockTeam = {
      getTeamStatus: vi.fn().mockResolvedValue({
        completedTasks: 0,
        totalTasks: 2,
        isComplete: false,
        agents: [],
        tasks: [],
      }),
    };
    const teamId = 'team2';
    (registry as any).teams.set(teamId, mockTeam);
    registeredIds.push(teamId);
    vi.useFakeTimers();
    const promise = registry.waitForTeam(teamId, 10);
    // First iteration calls getTeamStatus immediately, then sets timeout(200)
    await vi.runAllTimersAsync(); // advances the 200ms sleep
    const result = await promise;
    expect(result).toBe(false);
    vi.useRealTimers();
  });
});

// ==================== AgentTeam.setupChildRuntimes ====================
describe('AgentTeam.setupChildRuntimes (branch coverage)', () => {
  let team: AgentTeam;
  let parent: any;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test');
    parent = createMockRuntime();
    parent.session.sessionId = 'parent-session';
    // Ensure services.agentDir is a string (some tests may need to join)
    parent.services.agentDir = '/tmp';
  });

  it('rejects when roles are empty', async () => {
    await expect(team.setupChildRuntimes(parent)).rejects.toThrow('No agent roles defined');
  });

  it('uses baseCwd as string when provided (non-function)', async () => {
    (team as any).roles = ['agent-1']; // bypass validation for roles
    const mockCreate = vi.fn().mockResolvedValue(createMockRuntime());
    await team.setupChildRuntimes(parent, '/tmp', { createRuntime: mockCreate });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ cwd: '/tmp' })
    );
  });

  it('uses baseCwd function to compute per-agent cwd', async () => {
    (team as any).roles = ['agent-1', 'agent-2'];
    const mockCreate = vi.fn().mockResolvedValue(createMockRuntime());
    const baseCwdFn = (role: string) => `/tmp/${role}`;
    await team.setupChildRuntimes(parent, baseCwdFn, { createRuntime: mockCreate });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][1].cwd).toBe('/tmp/agent-1');
    expect(mockCreate.mock.calls[1][1].cwd).toBe('/tmp/agent-2');
  });

  it('uses custom createRuntime option when provided', async () => {
    (team as any).roles = ['agent-1'];
    const mockCreate = vi.fn().mockResolvedValue(createMockRuntime());
    await team.setupChildRuntimes(parent, undefined, { createRuntime: mockCreate });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ cwd: expect.any(String), agentDir: expect.any(String) })
    );
  });
});

// ==================== AgentTeam.handleAgentEvent ====================
describe('AgentTeam.handleAgentEvent (branch coverage)', () => {
  let team: AgentTeam;
  let notifySpy: vi.Mock;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test');
    notifySpy = vi.fn();
    team.setOnUpdate(notifySpy);

    const parent = createMockRuntime();
    parent.session.sessionId = 'parent-session';
    team.registerRuntime(parent, 'parent');
    const agent = createMockRuntime();
    agent.session.sessionId = 'agent-session';
    team.registerRuntime(agent, 'agent');
  });

  it('ignores tool_execution_start when toolName is not a string', () => {
    const internal = asAny(team);
    internal.handleAgentEvent('agent', { type: 'tool_execution_start', toolName: 123 });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('ignores tool_execution_end when toolName is not a string', () => {
    const internal = asAny(team);
    internal.handleAgentEvent('agent', { type: 'tool_execution_end', toolName: { name: 'read' } });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('ignores message_start when message is not an object', () => {
    const internal = asAny(team);
    internal.handleAgentEvent('agent', { type: 'message_start', message: 'string' });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('ignores message_start when message lacks role property', () => {
    const internal = asAny(team);
    internal.handleAgentEvent('agent', { type: 'message_start', message: { content: 'hi' } });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('does not create text when message_start role is neither user nor assistant', () => {
    const internal = asAny(team);
    internal.handleAgentEvent('agent', { type: 'message_start', message: { role: 'system', content: 'boot' } });
    expect(notifySpy).not.toHaveBeenCalled();
  });
});

// ==================== insertPendingIndexSorted duplicate handling ====================
describe('AgentTeam.insertPendingIndexSorted (duplicate branch)', () => {
  it('should not insert duplicate index that already exists at insertion point', () => {
    const team = new AgentTeam();
    asAny(team).pendingIndices = [1, 3, 5];
    asAny(team).insertPendingIndexSorted(3);
    expect(asAny(team).pendingIndices).toEqual([1, 3, 5]);
  });
});

// ==================== claimTask non-pending skip ====================
describe('AgentTeam.claimTask (skip non-pending tasks)', () => {
  let team: AgentTeam;

  beforeEach(async () => {
    team = new AgentTeam();
    team.setTeamId('test');
    const parent = createMockRuntime();
    parent.session.sessionId = 'parent';
    team.registerRuntime(parent, 'parent');
    const agent = createMockRuntime();
    agent.session.sessionId = 'agent1';
    team.registerRuntime(agent, 'agent-1');
    await team.initialize(['t0', 't1']);
    // Mark task 0 as completed (non-pending) but keep it in pendingIndices to simulate inconsistency/stale state
    const internal = asAny(team);
    const task0 = internal.taskStatuses.get(0);
    task0.status = 'completed'; // pendingIndices still contains 0
  });

  it('should skip tasks with status not pending and continue searching', async () => {
    const idx = await team.claimTask('agent-1');
    // Should claim task 1 (the first pending)
    expect(idx).toBe(1);
  });
});

// ==================== completeTask edge cases ====================
describe('AgentTeam.completeTask (branch coverage)', () => {
  let team: AgentTeam;

  beforeEach(async () => {
    team = new AgentTeam();
    team.setTeamId('test');
    const parent = createMockRuntime();
    parent.session.sessionId = 'parent';
    team.registerRuntime(parent, 'parent');
    const agent = createMockRuntime();
    agent.session.sessionId = 'agent1';
    team.registerRuntime(agent, 'agent-1');
    await team.initialize(['task0']);
  });

  it('should no-op when task index does not exist', async () => {
    await team.completeTask('agent-1', 99, 'result');
    // No exception thrown
    const results = await team.getResults();
    expect(results[0]).toBe(''); // unchanged
  });

  it('should remove task from pendingIndices when task is still pending (splice true branch)', async () => {
    // Setup: task0 is pending and assigned to agent-1 (normally claim would assign and remove from pendingIndices, but we simulate manually)
    const internal = asAny(team);
    const task0 = internal.taskStatuses.get(0)!;
    task0.assignee = 'agent-1'; // set assignee manually to satisfy assignee check
    task0.status = 'pending'; // ensure pending, and pendingIndices should contain 0 (initialize sets it)
    expect(internal.pendingIndices).toContain(0);
    await team.completeTask('agent-1', 0, 'done');
    expect(task0.status).toBe('completed');
    // pendingIndices should have spliced out index 0
    expect(internal.pendingIndices).not.toContain(0);
  });
});

// ==================== AgentTeam.waitForCompletion ====================
describe('AgentTeam.waitForCompletion (branch coverage)', () => {
  it('returns immediately if all tasks are already completed', async () => {
    const team = new AgentTeam();
    team.setTeamId('test');
    team.tasks = ['a', 'b'];
    const internal = asAny(team);
    internal.taskStatuses = new Map([
      [0, { assignee: null, status: 'completed', result: '', retryCount: 0 }],
      [1, { assignee: null, status: 'completed', result: '', retryCount: 0 }],
    ]);
    vi.useFakeTimers();
    const p = team.waitForCompletion();
    await vi.runAllTimersAsync(); // no timer pending, resolves immediately
    await p;
    vi.useRealTimers();
  });

  it('loops until tasks become completed (false then true)', async () => {
    const team = new AgentTeam();
    team.setTeamId('test');
    team.tasks = ['a'];
    const internal = asAny(team);
    internal.taskStatuses = new Map([
      [0, { assignee: null, status: 'pending', result: '', retryCount: 0 }],
    ]);
    // Mock getTeamStatus: first pending, then completed
    vi.spyOn(team, 'getTeamStatus')
      .mockResolvedValueOnce({
        completedTasks: 0, totalTasks: 1, isComplete: false,
        agents: [], tasks: [{ index: 0, assignee: null, status: 'pending', result: '', retryCount: 0 }]
      })
      .mockResolvedValueOnce({
        completedTasks: 1, totalTasks: 1, isComplete: true,
        agents: [], tasks: [{ index: 0, assignee: null, status: 'completed', result: '', retryCount: 0 }]
      });
    vi.useFakeTimers();
    const p = team.waitForCompletion();
    // First iteration: getStatus called, condition false, then sleep 100ms
    expect(team.getTeamStatus).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync(); // advances 100ms, allows second iteration
    await p;
    expect(team.getTeamStatus).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});


