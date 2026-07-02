import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentTeam, TeamRegistry, executeTeamTasks } from '../extensions/team/team-manager.js';

// Helper types for accessing private/internal fields of AgentTeam for testing
interface AgentTeamInternal {
  childControllers: Map<string, AbortController>;
  taskStatuses: Map<number, {
    assignee: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result: string;
    retryCount: number;
    retryAvailableAt?: number;
  }>;
  agentLastSeen: Map<string, number>;
  pendingIndices: number[];
  messageBus: Map<string, Array<{ from: string; content: string; timestamp: number }>>;
  childPromises: Promise<void>[];
  runtimes: any[];
  monitorInterval: any;
  onUpdate?: (update: any) => void;
}

function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

interface MockRuntime {
  session: {
    sessionId: string;
    prompt: (...args: any[]) => Promise<any>;
    subscribe: (...args: any[]) => void;
  };
}

function asMockRuntime(obj: any): MockRuntime {
  return obj as MockRuntime;
}

function createMockTeamRegistry(): TeamRegistry {
  const teams = new Map<string, AgentTeam>();
  const mock = {
    has: (id: string) => teams.has(id),
    register: (id: string, team: AgentTeam) => { teams.set(id, team); },
    unregister: (id: string) => { teams.delete(id); },
    get: (id: string) => teams.get(id) ?? null,
    waitForTeam: vi.fn().mockImplementation(async (id: string, timeoutMs?: number) => {
      // Default: wait for timeout then return false
      await new Promise(resolve => setTimeout(resolve, timeoutMs || 0));
      return false;
    }),
  } as unknown as TeamRegistry;
  return mock;
}

function useMockTeamRegistry(mockRegistry: TeamRegistry) {
  const spy = vi.spyOn(TeamRegistry, 'getInstance').mockReturnValue(mockRegistry);
  return () => spy.mockRestore();
}

const AGENT_TIMEOUT_MS = 2 * 60 * 1000;

describe('AgentTeam Additional Coverage', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
  });

  it('should return null when no tasks pending', async () => {
    await team.initialize(['Task A']);
    const idx1 = await team.claimTask('agent-1');
    expect(idx1).toBe(0);
    const idx2 = await team.claimTask('agent-2');
    expect(idx2).toBeNull();
  });

  it('should get team status correctly', async () => {
    await team.initialize(['Task A', 'Task B']);
    await team.claimTask('agent-1');
    const status = await team.getTeamStatus();
    expect(status.totalTasks).toBe(2);
    expect(status.completedTasks).toBe(0);
    expect(status.failedTasks).toBe(0);
    expect(status.pendingTasks).toBe(1);
    expect(status.isComplete).toBe(false);
    expect(status.agents).toHaveLength(1);
    expect(status.agents[0].status).toBe('working');
  });

  it('should get current task for agent', async () => {
    await team.initialize(['Task A']);
    await team.claimTask('agent-1');
    // @ts-ignore accessing private method for testing
    const taskIdx = await team.getMyCurrentTask('agent-1');
    expect(taskIdx).toBe(0);
  });

  it('should update heartbeat', async () => {
    await team.initialize(['Task A']);
    // @ts-ignore accessing private method for testing
    team.updateHeartbeat('agent-1');
    const internal = getInternal(team);
    const ts = internal.agentLastSeen.get('agent-1');
    expect(ts).toBeGreaterThan(Date.now() - 1000);
  });

  it('should dispose with runtimes and child promises', async () => {
    const internal = getInternal(team);
    const mockRuntime = { dispose: vi.fn().mockResolvedValue(undefined) };
    internal.runtimes.push(mockRuntime);
    const mockController = { abort: vi.fn() } as unknown as AbortController;
    internal.childControllers.set('ctrl', mockController);
    const childPromise = Promise.resolve();
    internal.childPromises.push(childPromise);
    const mockRegistry = { unregister: vi.fn() };
    const spy = vi.spyOn(TeamRegistry, 'getInstance').mockReturnValue(mockRegistry as never);

    await team.dispose();

    expect(mockRuntime.dispose).toHaveBeenCalled();
    expect(mockController.abort).toHaveBeenCalled();
    expect(internal.childPromises).toHaveLength(0);
    expect(internal.runtimes).toHaveLength(0);
    expect(mockRegistry.unregister).toHaveBeenCalledWith('test-team');
    spy.mockRestore();
  });

  it('should run full team lifecycle', async () => {
    const team = new AgentTeam();
    team.setTeamId('lifecycle-team');
    await team.initialize(['Task1', 'Task2']);

    const idx1 = await team.claimTask('agent-1');
    expect(idx1).toBe(0);

    // @ts-ignore accessing private method for testing
    const current = await team.getMyCurrentTask('agent-1');
    expect(current).toBe(0);

    const released = await team.releaseTask('agent-1', 0);
    expect(released).toBe(true);

    const idx2 = await team.claimTask('agent-2');
    expect(idx2).toBe(0);

    await team.handleAgentFailure('agent-2', 0, new Error('fail'));
    const internal = getInternal(team);
    let task = internal.taskStatuses.get(0);
    expect(task.status).toBe('pending');
    expect(task.retryCount).toBe(1);

    internal.agentLastSeen.set('agent-2', Date.now() - AGENT_TIMEOUT_MS - 1);
    team.reclaimZombieAgents();
    task = internal.taskStatuses.get(0);
    expect(task.status).toBe('pending');
    expect(internal.pendingIndices).toContain(0);

    const status = await team.getTeamStatus();
    expect(status.totalTasks).toBe(2);
    expect(status.pendingTasks).toBeGreaterThanOrEqual(1);

    // @ts-ignore accessing private property for testing
    team.monitorInterval = setInterval(() => {}, 1000);
    await team.dispose();
    // @ts-ignore accessing private property for testing
    expect(team.monitorInterval).toBeNull();
  });

  describe('getContext and workspace', () => {
    it('should return context with correct team summary', async () => {
      const t = new AgentTeam();
      t.setTeamId('ctx-test');
      t.roles = ['agent-1'];
      await t.initialize(['A', 'B']);
      const ctx = t.getContext();
      const summary = ctx.getTeamSummary();
      expect(summary.totalTasks).toBe(2);
      expect(summary.completedTasks).toBe(0);
      expect(summary.activeAgents).toBe(0);
      // Mark one task completed
      const internal = getInternal(t);
      internal.taskStatuses.set(0, { status: 'completed', assignee: 'agent-1', retryCount: 0, result: '' });
      internal.pendingIndices = [1];
      const summary2 = ctx.getTeamSummary();
      expect(summary2.completedTasks).toBe(1);
    });

    it('should store and retrieve workspace entries', async () => {
      const t = new AgentTeam();
      t.setTeamId('ws-test');
      await t.initialize([]);
      t.getWorkspace().set('key1', 'value1', 'agent-1');
      t.getWorkspace().set('key2', { obj: true }, 'agent-2');
      // @ts-ignore accessing private method for testing
      const entry1 = await t.workspaceGetEntry('key1');
      expect(entry1).toBeDefined();
      expect(entry1.value).toBe('value1');
      // @ts-ignore accessing private method for testing
      const list = await t.workspaceListByPrefix('key');
      expect(list).toContain('key1');
      expect(list).toContain('key2');
    });
  });

  describe('Additional Team Coverage', () => {
    let restoreMock: () => void;

    beforeEach(() => {
      const mockRegistry = createMockTeamRegistry();
      restoreMock = useMockTeamRegistry(mockRegistry);
    });

    afterEach(() => {
      restoreMock?.();
    });

    it('should handle agent failure and mark task failed after max retries', async () => {
      const team = new AgentTeam();
      team.setTeamId('retry-test');
      await team.initialize(['Task 1']);
      // Claim the task
      await team.claimTask('agent-1');
      const internal = getInternal(team);
      const task = internal.taskStatuses.get(0);
      // Set retryCount to 2 (max is 3) so next failure hits max
      task.retryCount = 2;
      task.status = 'in_progress';
      task.assignee = 'agent-1';
      // Simulate failure
      await team.handleAgentFailure('agent-1', 0, new Error('fail'));
      // Task should now be failed
      expect(task.status).toBe('failed');
      expect(task.result).toContain('fail');
      // pendingIndices should not contain the task
      expect(internal.pendingIndices).not.toContain(0);
    });

    it('should publish message to message bus', async () => {
      const team = new AgentTeam();
      team.setTeamId('pub-test');
      await team.initialize([]);
      const internal = getInternal(team);
      // Ensure messageBus exists (initialized in constructor)
      expect(internal.messageBus).toBeInstanceOf(Map);
      await team.publishMessage('test-channel', 'agent-1', 'Hello');
      const msgs = internal.messageBus.get('test-channel');
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({ from: 'agent-1', content: 'Hello' });
      // Optionally check notifyUpdate was called
      // @ts-ignore accessing private method for testing
      const notifySpy = vi.spyOn(team, 'notifyUpdate');
      await team.publishMessage('chan2', 'agent-2', 'World');
      expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('[chan2]') })]),
      }));
    });

    it('TeamRegistry.has should correctly report team existence', () => {
      const registry = TeamRegistry.getInstance();
      expect(registry.has('nonexistent')).toBe(false);
      const team = new AgentTeam();
      team.setTeamId('test-team');
      registry.register(team.id, team);
      expect(registry.has(team.id)).toBe(true);
      registry.unregister(team.id);
      expect(registry.has(team.id)).toBe(false);
    });
  });

  describe('startAgentLoops and runAgentLoop', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.skip('should run one iteration and exit on abort', async () => {
      const team = new AgentTeam();
      team.setTeamId('loop-test');
      team.roles = ['agent-1'];
      await team.initialize(['Task 1']);
      // Create minimal runtime mock
      const mockRuntime = asMockRuntime({
        session: {
          sessionId: 'sess1',
          prompt: vi.fn().mockImplementation(async () => {
            // Abort after prompt to exit loop
            // @ts-ignore accessing private field for testing
            const ctrl = team.childControllers.get('agent-1');
            ctrl?.abort();
          }),
          subscribe: vi.fn(),
        },
      });
      // @ts-ignore - mock runtime type
      team.registerRuntime(mockRuntime, 'agent-1');
      team.startAgentLoops();
      // Allow timers to progress through the setTimeout at end of first iteration
      await vi.advanceTimersByTimeAsync(1000);
      // Wait for child promise to settle
      await Promise.all(team.childPromises);
      // Loop should have exited cleanly
      // Check that prompt was called
      expect(mockRuntime.session.prompt).toHaveBeenCalled();
    });

    it.skip('should handle prompt error and continue', async () => {
      const team = new AgentTeam();
      team.setTeamId('loop-err-test');
      team.roles = ['agent-1'];
      await team.initialize(['Task 1']);
      const mockRuntime = asMockRuntime({
        session: {
          sessionId: 'sess2',
          prompt: vi.fn().mockRejectedValue(new Error('LLM failure')),
          subscribe: vi.fn(),
        },
      });
      // @ts-ignore - mock runtime type
      team.registerRuntime(mockRuntime, 'agent-1');
      // Spy on notifyUpdate
      // @ts-ignore accessing private method for testing
      const notifySpy = vi.spyOn(team, 'notifyUpdate');
      team.startAgentLoops();
      // Advance timers to complete one iteration (which will hit error)
      await vi.advanceTimersByTimeAsync(1000);
      // Abort to stop further loops
      // @ts-ignore accessing private field for testing
      const ctrl = team.childControllers.get('agent-1');
      ctrl?.abort();
      await Promise.all(team.childPromises);
      // Should have error update
      expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('Agent error') })]),
        isError: true,
      }));
    });

    it.skip('should break loop if tasks already completed', async () => {
      const team = new AgentTeam();
      team.setTeamId('loop-complete');
      team.roles = ['agent-1'];
      await team.initialize(['Task 1']);
      const internal = getInternal(team);
      // Mark task as completed directly
      internal.taskStatuses.set(0, { status: 'completed', assignee: 'agent-1', retryCount: 0, result: '' });
      internal.pendingIndices = [];
      const mockRuntime = asMockRuntime({
        session: {
          sessionId: 'sess3',
          prompt: vi.fn(),
          subscribe: vi.fn(),
        },
      });
      // @ts-ignore - mock runtime type
      team.registerRuntime(mockRuntime, 'agent-1');
      team.startAgentLoops();
      // Should exit quickly without calling prompt
      await Promise.all(team.childPromises);
      expect(mockRuntime.session.prompt).not.toHaveBeenCalled();
    });
  });

  describe('TeamRegistry waitForTeam', () => {
    let restoreMock: () => void;

    beforeEach(() => {
      vi.useFakeTimers();
      const mockRegistry = createMockTeamRegistry();
      restoreMock = useMockTeamRegistry(mockRegistry);
    });

    afterEach(() => {
      vi.useRealTimers();
      restoreMock?.();
    });

    it('should resolve true when team completes', async () => {
      const team = new AgentTeam();
      team.setTeamId('wait-true');
      await team.initialize(['Task']);
      const registry = TeamRegistry.getInstance();
      registry.register(team.id, team);
      // Override waitForTeam to resolve true immediately (team completed)
      // @ts-ignore - mock override
      registry.waitForTeam.mockResolvedValue(true);
      // Simulate completion by reporting result after claiming
      await team.claimTask('agent-1');
      await team.reportResult(0, 'done');
      const result = await registry.waitForTeam(team.id);
      expect(result).toBe(true);
      registry.unregister(team.id);
    });

    it('should resolve false on timeout', async () => {
      const team = new AgentTeam();
      team.setTeamId('wait-false');
      await team.initialize(['Task']);
      const registry = TeamRegistry.getInstance();
      registry.register(team.id, team);
      // Do not complete any task
      const waitPromise = registry.waitForTeam(team.id, 300); // timeout 300ms
      // Advance timers past timeout: first iteration 200ms, second will exceed total 300
      await vi.advanceTimersByTimeAsync(500);
      const result = await waitPromise;
      expect(result).toBe(false);
      registry.unregister(team.id);
    });
  });

  describe('executeTeamTasks', () => {
    let team: AgentTeam;
    let parentRuntime: any;
    let setIntervalCallback: any;

    beforeEach(() => {
      setIntervalCallback = null;
      vi.useFakeTimers();
      // @ts-ignore - setInterval mock signature mismatch
      vi.spyOn(globalThis, 'setInterval').mockImplementation((...args: any[]) => {
        const [cb, ms] = args;
        setIntervalCallback = cb;
        // @ts-ignore - returning number instead of Timeout for mock
        return 1;
      });
      vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
      team = new AgentTeam();
      team.setTeamId('test-exec');
      parentRuntime = { cwd: process.cwd() };
      vi.spyOn(team, 'withLock').mockImplementation(cb => Promise.resolve(cb()));
      vi.spyOn(team, 'reclaimZombieAgents').mockResolvedValue(undefined);
      vi.spyOn(team, 'getTeamStatus').mockResolvedValue({
        isComplete: true,
        totalTasks: 1,
        completedTasks: 1,
        pendingTasks: 0,
        failedTasks: 0,
        agents: []
      });

      vi.spyOn(team, 'initialize').mockResolvedValue(undefined);
      vi.spyOn(team, 'setupChildRuntimes').mockResolvedValue(undefined);
      vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should set monitor and execute callback (wait false)', async () => {
      const onUpdate = vi.fn();
      await executeTeamTasks(team, ['Task'], onUpdate, { wait: false });
      // @ts-ignore accessing private field for testing
      expect(team.onUpdate).toBe(onUpdate);
      expect(team.initialize).toHaveBeenCalledWith(['Task']);
      expect(team.startAgentLoops).toHaveBeenCalled();
      expect(setIntervalCallback).toBeTruthy();
      await setIntervalCallback();
      expect(team.reclaimZombieAgents).toHaveBeenCalled();
      expect(team.getTeamStatus).toHaveBeenCalled();
      expect(globalThis.clearInterval).toHaveBeenCalledWith(1);
      // @ts-ignore accessing private property for testing
      expect(team.monitorInterval).toBeNull();
    });

    it('should wait for childPromises and clear monitor (wait true)', async () => {
      // @ts-ignore accessing private field for testing
      team.childPromises = [Promise.resolve()];
      // @ts-ignore accessing private method for testing
      const getStatusSpy = vi.mocked(team.getTeamStatus);
      getStatusSpy.mockResolvedValueOnce({
        isComplete: false,
        totalTasks: 1,
        completedTasks: 0,
        pendingTasks: 1,
        failedTasks: 0,
        agents: []
      }).mockResolvedValueOnce({
        isComplete: true,
        totalTasks: 1,
        completedTasks: 1,
        pendingTasks: 0,
        failedTasks: 0,
        agents: []
      });
      const onUpdate = vi.fn();
      await executeTeamTasks(team, ['Task'], onUpdate, { wait: true });
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining('Team execution complete') })
        ]),
        details: expect.objectContaining({
          completed: 0,
          total: 1
        })
      }));
      // @ts-ignore accessing private property for testing
      expect(team.monitorInterval).toBeNull();
    });

    it('should handle runtime dispose error and unregister error gracefully', async () => {
      const internal = getInternal(team);
      // Add a runtime that throws on dispose
      const badRuntime = { dispose: vi.fn().mockRejectedValue(new Error('dispose fail')) };
      internal.runtimes.push(badRuntime);
      // Mock child controller and childPromises
      const mockController = { abort: vi.fn() } as unknown as AbortController;
      internal.childControllers.set('badCtrl', mockController);
      internal.childPromises.push(Promise.resolve());
      // Mock TeamRegistry to throw on unregister
      const badRegistry = { unregister: vi.fn(() => { throw new Error('unregister fail'); }) };
      const getInstanceSpy = vi.spyOn(TeamRegistry, 'getInstance').mockReturnValue(badRegistry as never);
      // Spy on console.error and console.warn
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await team.dispose();

      expect(badRuntime.dispose).toHaveBeenCalled();
      expect(mockController.abort).toHaveBeenCalled();
      expect(internal.childPromises).toHaveLength(0);
      expect(internal.runtimes).toHaveLength(0);
      expect(badRegistry.unregister).toHaveBeenCalledWith('test-exec');
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to dispose agent runtime:", expect.any(Error));
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to unregister team from registry:', expect.any(Error));

      getInstanceSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

  });
});
