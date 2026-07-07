import { AgentTeam, startCompletionMonitor } from '../team-manager.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockRuntime } from './test-utils.js';

describe('startCompletionMonitor coverage', () => {
  let team: AgentTeam;

  beforeEach(() => {
    vi.useFakeTimers();
    team = new AgentTeam();
    team.id = 'test';
    // Register a runtime to avoid some undefined errors
    const rt = createMockRuntime();
    rt.session.sessionId = 'agent-1';
    team.registerRuntime(rt, 'agent-1');
    team.initialize(['task1']);
  });

  afterEach(async () => {
    await team.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should log error when getTeamStatus rejects', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    // Mock getTeamStatus to reject
    vi.spyOn(team, 'getTeamStatus').mockRejectedValue(new Error('status fail'));

    startCompletionMonitor(team);

    // Advance timers to trigger interval callback
    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Status error:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should log error when withLock rejects', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    // Mock acquireLock to reject (withLock will reject)
    vi.spyOn(team as any, 'acquireLock').mockRejectedValue(new Error('lock fail'));

    startCompletionMonitor(team);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Reclaim error:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });
});
