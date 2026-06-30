import { describe, it, expect, beforeEach } from 'vitest';
import { TeamRegistry } from '../team-manager.js';

describe('TeamRegistry', () => {
  beforeEach(() => {
    // Reset the singleton instance between tests by clearing the static instance via reflection? 
    // Since getInstance caches, we can't easily reset. We'll test across multiple calls within one test.
  });

  it('should return same instance on multiple getInstance calls', () => {
    const r1 = TeamRegistry.getInstance();
    const r2 = TeamRegistry.getInstance();
    expect(r1).toBe(r2);
  });

  it('should register and unregister teams', () => {
    const registry = TeamRegistry.getInstance();
    const team = { id: 'team1' } as any;

    registry.register(team.id, team);
    expect(registry['teams'].has(team.id)).toBe(true);

    registry.unregister(team.id);
    expect(registry['teams'].has(team.id)).toBe(false);
  });

  it('should handle unregister of non-existent team without error', () => {
    const registry = TeamRegistry.getInstance();
    // Should not throw
    registry.unregister('nonexistent');
  });

  it('should clear autoDisposeTimer on unregister if set', () => {
    const registry = TeamRegistry.getInstance();
    const teamId = 'team2';
    const timer = { unref: () => {} } as any;
    registry['autoDisposeTimers'].set(teamId, timer);
    expect(registry['autoDisposeTimers'].has(teamId)).toBe(true);

    registry.unregister(teamId);
    expect(registry['autoDisposeTimers'].has(teamId)).toBe(false);
  });
});
