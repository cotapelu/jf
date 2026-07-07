import * as teamManager from '../team-manager.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockRuntime } from './test-utils.js';

const { AgentTeam, executeTeamTasks } = teamManager;

describe('AgentTeam executeTeamTasks edge cases', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.id = 'test-team';
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (team) {
      await team.dispose();
    }
  });

  it('should catch onUpdate throwing during sendImmediateStartUpdate', async () => {
    const badOnUpdate = vi.fn(() => { throw new Error('update fail'); });
    const initSpy = vi.spyOn(team, 'initialize').mockResolvedValue(undefined);
    const startSpy = vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // With error handling, executeTeamTasks should not reject
    await expect(executeTeamTasks(team, ['t1'], badOnUpdate, { wait: false })).resolves.toBe(team);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send immediate start update:', expect.any(Error));

    initSpy.mockRestore();
    startSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle initialize throwing', async () => {
    const initSpy = vi.spyOn(team, 'initialize').mockRejectedValue(new Error('init fail'));
    const startSpy = vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});

    await expect(executeTeamTasks(team, ['t1'], undefined, { wait: false })).rejects.toThrow('init fail');

    initSpy.mockRestore();
    startSpy.mockRestore();
  });

  it('should handle childPromises rejection with wait=true', async () => {
    const initSpy = vi.spyOn(team, 'initialize').mockResolvedValue(undefined);
    const startSpy = vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});
    (team as any).childPromises = [Promise.reject(new Error('child crash'))];

    await expect(executeTeamTasks(team, ['t1'], undefined, { wait: true })).rejects.toThrow('child crash');

    initSpy.mockRestore();
    startSpy.mockRestore();
  });

  it('should clear monitorInterval even if childPromises reject (finally)', async () => {
    const initSpy = vi.spyOn(team, 'initialize').mockResolvedValue(undefined);
    const startSpy = vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});
    (team as any).childPromises = [Promise.reject(new Error('fail'))];
    (team as any).monitorInterval = setInterval(() => {}, 1000);

    try {
      await expect(executeTeamTasks(team, ['t1'], undefined, { wait: true })).rejects.toThrow('child crash');
    } catch {}
    expect((team as any).monitorInterval).toBeNull();

    initSpy.mockRestore();
    startSpy.mockRestore();
  });

  it('should call onUpdate with completion message after wait resolves', async () => {
    const initSpy = vi.spyOn(team, 'initialize').mockResolvedValue(undefined);
    const startSpy = vi.spyOn(team, 'startAgentLoops').mockImplementation(() => {});
    const onUpdateSpy = vi.fn();

    (team as any).childPromises = [Promise.resolve()];

    await executeTeamTasks(team, ['t1'], onUpdateSpy as any, { wait: true });

    expect(onUpdateSpy).toHaveBeenCalledWith(
      team.createUpdate(
        expect.stringContaining('Team execution complete'),
        expect.objectContaining({ completed: expect.any(Number), total: expect.any(Number) })
      )
    );

    initSpy.mockRestore();
    startSpy.mockRestore();
  });
});
