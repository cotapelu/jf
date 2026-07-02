import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamRegistry } from '../team-manager.js';

// Helper to create a mock team with controllable getTeamStatus
function createMockTeamStatus(
  statuses: Array<{ completedTasks: number; totalTasks: number; tasks?: any[]; agents?: any[] }>
): any {
  let callCount = 0;
  return {
    getTeamStatus: vi.fn().mockImplementation(async () => {
      const status = statuses[callCount % statuses.length];
      callCount++;
      return status;
    })
  };
}

describe('TeamRegistry.waitForTeam', () => {
  let registry: TeamRegistry;
  let mockTeam: any;

  beforeEach(() => {
    // Create a fresh registry instance to avoid singleton pollution
    registry = new TeamRegistry();
    mockTeam = createMockTeamStatus([{ completedTasks: 0, totalTasks: 1, tasks: [], agents: [] }]);
    // Inject into private teams map
    (registry as any).teams = new Map([['test-team', mockTeam]]);
  });

  it('should throw if team not found', async () => {
    await expect(registry.waitForTeam('nonexistent')).rejects.toThrow(/not found/);
  });

  it('should return true when team completes (status.isComplete)', async () => {
    // First call returns complete
    mockTeam.getTeamStatus.mockResolvedValueOnce({ completedTasks: 1, totalTasks: 1, tasks: [], agents: [] });
    const result = await registry.waitForTeam('test-team');
    expect(result).toBe(true);
    expect(mockTeam.getTeamStatus).toHaveBeenCalledTimes(1);
  });

  it('should return false when timeout occurs before completion', async () => {
    vi.useFakeTimers();
    // Mock to always return incomplete
    mockTeam.getTeamStatus.mockResolvedValue({ completedTasks: 0, totalTasks: 1, tasks: [], agents: [] });

    const waitPromise = registry.waitForTeam('test-team', 100); // 100ms timeout

    // After initial call, the loop will await a 200ms delay. Advance timers past timeout.
    await vi.advanceTimersByTimeAsync(250);

    const result = await waitPromise;
    expect(result).toBe(false);
    // Should have called getTeamStatus at least twice (initial + one after delay, then timeout check)
    expect(mockTeam.getTeamStatus).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('should eventually return true if team completes after a few polls', async () => {
    vi.useFakeTimers();
    // Sequence: first incomplete, then complete
    mockTeam.getTeamStatus
      .mockResolvedValueOnce({ completedTasks: 0, totalTasks: 1, tasks: [], agents: [] })
      .mockResolvedValueOnce({ completedTasks: 1, totalTasks: 1, tasks: [], agents: [] });

    const waitPromise = registry.waitForTeam('test-team', 5000);

    // Advance timers to allow the loop to run second iteration
    await vi.advanceTimersByTimeAsync(250);

    const result = await waitPromise;
    expect(result).toBe(true);
    vi.useRealTimers();
  });
});
