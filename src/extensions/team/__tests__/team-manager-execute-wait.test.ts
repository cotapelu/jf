import { AgentTeam, executeTeamTasks } from '../team-manager.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AgentTeam executeTeamTasks wait option', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.id = 'test-team';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not wait when wait=false (default)', async () => {
    // Mock heavy operations
    const initSpy = vi.spyOn(team, 'initialize').mockResolvedValue(undefined);
    const startSpy = vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});

    // We want to ensure executeTeamTasks returns without awaiting childPromises
    const execPromise = executeTeamTasks(team, ['task1']);

    // It should return quickly (before any child promises resolve)
    await execPromise;
    // monitorInterval should be set (monitor started)
    expect(team.monitorInterval).not.toBeNull();

    initSpy.mockRestore();
    startSpy.mockRestore();
    // clear interval to avoid timer leaks
    if (team.monitorInterval) clearInterval(team.monitorInterval);
  });

  it('should wait when wait=true', async () => {
    const initSpy = vi.spyOn(team, 'initialize').mockResolvedValue(undefined);
    const startSpy = vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});
    // We do NOT mock startCompletionMonitor; let it set interval

    // Push a dummy child promise that stays pending until we resolve it
    let resolveDummy: () => void;
    const dummyPromise = new Promise<void>((resolve) => { resolveDummy = resolve; });
    (team as any).childPromises = [dummyPromise];

    const execPromise = executeTeamTasks(team, ['t'], undefined, { wait: true });

    // The promise should not resolve immediately
    // Resolve the dummy after a tick
    await Promise.resolve(); // allow exec to start waiting
    resolveDummy!();

    await execPromise;
    // After waiting and resolution, the finally block clears the interval
    expect(team.monitorInterval).toBeNull();

    initSpy.mockRestore();
    startSpy.mockRestore();
  });
});
