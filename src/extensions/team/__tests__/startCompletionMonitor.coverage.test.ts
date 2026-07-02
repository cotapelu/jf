import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentTeam, startCompletionMonitor, TeamRegistry } from '../team-manager.js';

describe('startCompletionMonitor Coverage', () => {
  let team: AgentTeam;

  beforeEach(() => {
    vi.useFakeTimers();
    team = new AgentTeam();
    team.id = 'test-team';
    // Set monitorInterval to null initially (default undefined)
  });

  afterEach(() => {
    if (team.monitorInterval) {
      clearInterval(team.monitorInterval);
    }
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('should schedule periodic monitor', () => {
    // Call the function
    startCompletionMonitor(team);

    // Interval should be set
    expect(team.monitorInterval).not.toBeNull();
  });

  it('should handle reclaimZombieAgents rejection', async () => {
    // Mock withLock to reject when invoking the callback
    const withLockSpy = vi.spyOn(team, 'withLock').mockImplementation(() => Promise.reject(new Error('lock fail')));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    startCompletionMonitor(team);

    // Advance to trigger the interval
    vi.advanceTimersByTime(1100);
    // Wait for promise microtasks
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Reclaim error'), expect.anything());

    withLockSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle getTeamStatus rejection', async () => {
    const getStatusSpy = vi.spyOn(team, 'getTeamStatus').mockRejectedValue(new Error('status fail'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    startCompletionMonitor(team);
    vi.advanceTimersByTime(1100);
    // Flush microtasks from the interval callback
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Status error'), expect.anything());

    getStatusSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should not clear interval when team not complete', async () => {
    const getStatusSpy = vi.spyOn(team, 'getTeamStatus').mockResolvedValue({
      completedTasks: 0,
      failedTasks: 0,
      pendingTasks: 1,
      totalTasks: 1,
      isComplete: false,
      agents: [],
      tasks: [],
    } as any);
    const resetTimerSpy = vi.spyOn(TeamRegistry.getInstance(), 'resetAutoDisposeTimer');

    startCompletionMonitor(team);
    vi.advanceTimersByTime(1100);
    await Promise.resolve();

    // Interval should still be running
    expect(team.monitorInterval).not.toBeNull();
    // Should not have called resetAutoDisposeTimer
    expect(resetTimerSpy).not.toHaveBeenCalled();

    getStatusSpy.mockRestore();
    resetTimerSpy.mockRestore();
  });

  it('should clear interval and call resetAutoDisposeTimer when team complete', async () => {
    const getStatusSpy = vi.spyOn(team, 'getTeamStatus').mockResolvedValue({
      completedTasks: 1,
      failedTasks: 0,
      pendingTasks: 0,
      totalTasks: 1,
      isComplete: true,
      agents: [],
      tasks: [],
    } as any);
    const resetTimerSpy = vi.spyOn(TeamRegistry.getInstance(), 'resetAutoDisposeTimer').mockImplementation(() => {});

    startCompletionMonitor(team);
    vi.advanceTimersByTime(1100);
    await Promise.resolve();

    // Interval should be cleared
    expect(team.monitorInterval).toBeNull();
    // resetAutoDisposeTimer called with team.id
    expect(resetTimerSpy).toHaveBeenCalledWith(team.id);

    getStatusSpy.mockRestore();
    resetTimerSpy.mockRestore();
  });

  it('should NOT clear interval when isComplete true but totalTasks is zero', async () => {
    const getStatusSpy = vi.spyOn(team, 'getTeamStatus').mockResolvedValue({
      completedTasks: 0,
      failedTasks: 0,
      pendingTasks: 0,
      totalTasks: 0,
      isComplete: true,
      agents: [],
      tasks: [],
    } as any);
    const resetTimerSpy = vi.spyOn(TeamRegistry.getInstance(), 'resetAutoDisposeTimer');

    startCompletionMonitor(team);
    vi.advanceTimersByTime(1100);
    await Promise.resolve();

    // totalTasks is 0, condition false -> interval remains
    expect(team.monitorInterval).not.toBeNull();
    expect(resetTimerSpy).not.toHaveBeenCalled();

    getStatusSpy.mockRestore();
    resetTimerSpy.mockRestore();
  });

  it('should handle exception from resetAutoDisposeTimer and still clear interval', async () => {
    const getStatusSpy = vi.spyOn(team, 'getTeamStatus').mockResolvedValue({
      completedTasks: 1,
      failedTasks: 0,
      pendingTasks: 0,
      totalTasks: 1,
      isComplete: true,
      agents: [],
      tasks: [],
    } as any);
    const resetTimerSpy = vi.spyOn(TeamRegistry.getInstance(), 'resetAutoDisposeTimer').mockImplementation(() => {
      throw new Error('reset fail');
    });
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    startCompletionMonitor(team);
    vi.advanceTimersByTime(1100);
    await Promise.resolve();

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to schedule auto-dispose'), expect.anything());
    // Interval should be cleared even if reset throws
    expect(team.monitorInterval).toBeNull();

    getStatusSpy.mockRestore();
    resetTimerSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
