import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamRegistry } from '../team-manager.js';
import { createTestTeam } from './test-utils.js';

describe('TeamManager Auto-Dispose Coverage', () => {
  let team: any;
  let registry: TeamRegistry;

  beforeEach(() => {
    registry = TeamRegistry.getInstance();
  });

  afterEach(async () => {
    if (team) {
      try {
        await team.dispose();
      } catch (e) {
        // ignore dispose errors during cleanup
      }
      team = null;
    }
  });

  it('should handle dispose error and leave team registered', async () => {
    const mockTeam = createTestTeam('auto-dispose-error');
    mockTeam.dispose = vi.fn().mockRejectedValue(new Error('dispose fail'));
    registry.register(mockTeam.id, mockTeam);
    team = mockTeam;

    const anyRegistry = registry as any;
    await anyRegistry.autoDisposeTeam(mockTeam.id);

    // Team should still be present since dispose threw
    expect(registry.has(mockTeam.id)).toBe(true);

    // Cleanup manually
    registry.unregister(mockTeam.id);
  });

  it('should successfully auto-dispose team when dispose resolves', async () => {
    const mockTeam = createTestTeam('auto-dispose-success');
    mockTeam.dispose = vi.fn().mockResolvedValue(undefined);
    registry.register(mockTeam.id, mockTeam);
    team = mockTeam;

    const anyRegistry = registry as any;
    await anyRegistry.autoDisposeTeam(mockTeam.id);

    // Team should be unregistered
    expect(registry.has(mockTeam.id)).toBe(false);
  });

  it('should do nothing if team not found', async () => {
    const anyRegistry = registry as any;
    // Should not throw
    await anyRegistry.autoDisposeTeam('non-existent-id');
    // Nothing to assert; just ensure no error
  });
});
