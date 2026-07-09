import { createTeamTool } from '../team-tool.js';
import { TeamRegistry } from '../team-manager.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock team manager functions BEFORE importing tool executed
vi.mock('../team-manager.js', async () => {
  const actual = await vi.importActual('../team-manager.js');
  return {
    ...actual,
    bootPiclawTeam: vi.fn(),
    executeTeamTasks: vi.fn(),
    TeamRegistry: {
      getInstance: vi.fn(() => ({
        get: vi.fn(),
        resetAutoDisposeTimer: vi.fn(),
      })),
    },
  };
});

// Minimal mock context
const mockCtx: any = {
  runtime: { session: { sessionId: 'test-session' } },
  session: { sessionId: 'test-session' },
};

// Get references to mocked functions after vi.mock
const { bootPiclawTeam, executeTeamTasks, TeamRegistry: MockTeamRegistry } = await import('../team-manager.js');
const teamTool = createTeamTool();
const toolCallId = 'test-call-1';

describe('team_run tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset TeamRegistry mock
    MockTeamRegistry.getInstance.mockReturnValue({
      get: vi.fn(),
      resetAutoDisposeTimer: vi.fn(),
    });
  });

  describe('parameter validation', () => {
    it('should reject call reference strings with clear error', async () => {
      const result: any = await teamTool.execute(toolCallId, 'call_abc123', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('call reference');
      expect(result.details?.error).toBe('Unresolved call reference');
    });

    it('should reject invalid JSON strings', async () => {
      const result: any = await teamTool.execute(toolCallId, 'not valid json', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Invalid JSON');
    });

    it('should reject object without tasks array', async () => {
      const result: any = await teamTool.execute(toolCallId, { teamSize: 2 }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tasks must be a non-empty array');
    });

    it('should reject empty tasks array', async () => {
      const result: any = await teamTool.execute(toolCallId, { tasks: [] }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tasks must be a non-empty array');
    });

    it('should accept valid object with tasks (may fail later due to runtime)', async () => {
      const result: any = await teamTool.execute(toolCallId, { tasks: ['ls'], teamSize: 1 }, undefined, undefined, mockCtx);
      // Should NOT have param validation errors
      expect(result.details?.error).not.toBe('Invalid JSON');
      expect(result.details?.error).not.toBe('Unresolved call reference');
    });

    it('should reject non-object/non-string params', async () => {
      // @ts-ignore - testing runtime type handling
      const result: any = await teamTool.execute(toolCallId, 12345, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Invalid parameters');
    });
  });

  describe('JSON string parsing', () => {
    it('should parse valid JSON string param', async () => {
      const result: any = await teamTool.execute(toolCallId, '{"tasks": ["ls"], "teamSize": 1}', undefined, undefined, mockCtx);
      expect(result.details?.error).not.toBe('Invalid JSON');
    });
  });

  describe('team status query (teamId provided)', () => {
    const mockTeam = {
      getTeamStatus: vi.fn().mockResolvedValue({
        completedTasks: 2,
        totalTasks: 5,
        agents: [{ id: 'a1' }, { id: 'a2' }],
      }),
    };

    it('should return team status when teamId exists', async () => {
      MockTeamRegistry.getInstance.mockReturnValue({
        get: vi.fn().mockReturnValue(mockTeam),
        resetAutoDisposeTimer: vi.fn(),
      });

      const result: any = await teamTool.execute(toolCallId, { teamId: 'team-123' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Team team-123 status');
      expect(result.details?.status).toBeDefined();
    });

    it('should return error when team not found', async () => {
      MockTeamRegistry.getInstance.mockReturnValue({
        get: vi.fn().mockReturnValue(null),
        resetAutoDisposeTimer: vi.fn(),
      });

      const result: any = await teamTool.execute(toolCallId, { teamId: 'missing-team' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should reset auto-dispose timer on query', async () => {
      const registry = {
        get: vi.fn().mockReturnValue(mockTeam),
        resetAutoDisposeTimer: vi.fn(),
      };
      MockTeamRegistry.getInstance.mockReturnValue(registry);

      await teamTool.execute(toolCallId, { teamId: 'team-123' }, undefined, undefined, mockCtx);
      expect(registry.resetAutoDisposeTimer).toHaveBeenCalledWith('team-123');
    });
  });

  describe('team creation (tasks provided)', () => {
    const mockTeamCreate = { id: 'team-abc', roles: ['planner', 'coder'] };

    beforeEach(() => {
      bootPiclawTeam.mockResolvedValue(mockTeamCreate);
      executeTeamTasks.mockResolvedValue(undefined);
    });

    it('should create team and return teamId', async () => {
      const result: any = await teamTool.execute(toolCallId, { tasks: ['task1'] }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Team started');
      expect(result.details?.teamId).toBe('team-abc');
    });

    it('should call bootPiclawTeam with correct args', async () => {
      await teamTool.execute(toolCallId, { tasks: ['t1'], teamSize: 3, teamRoles: ['lead'] }, undefined, undefined, mockCtx);
      expect(bootPiclawTeam).toHaveBeenCalledWith(mockCtx.runtime, { teamSize: 3, teamRoles: ['lead'] });
    });

    it('should call executeTeamTasks with tasks and wrapped onUpdate', async () => {
      const onUpdate = vi.fn();
      await teamTool.execute(toolCallId, { tasks: ['t1'] }, undefined, onUpdate, mockCtx);
      expect(executeTeamTasks).toHaveBeenCalledWith(
        mockTeamCreate,
        ['t1'],
        expect.any(Function),
        {}
      );
    });

    it('should handle execution error and return error result', async () => {
      executeTeamTasks.mockRejectedValue(new Error('Task execution failed'));

      const result: any = await teamTool.execute(toolCallId, { tasks: ['t1'] }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Team execution failed');
    });
  });

  describe('missing runtime context', () => {
    it('should throw if ctx.runtime is undefined', async () => {
      const badCtx: any = { runtime: undefined };
      const result: any = await teamTool.execute(toolCallId, { tasks: ['t1'] }, undefined, undefined, badCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No runtime context');
    });
  });

  describe('onUpdate accumulation', () => {
    const mockTeamAcc = { id: 'team-acc', roles: ['a'] };
    const onUpdate = vi.fn();

    beforeEach(() => {
      bootPiclawTeam.mockResolvedValue(mockTeamAcc);
      executeTeamTasks.mockImplementation(async (team, tasks, wrappedUpdate, options) => {
        wrappedUpdate?.({
          content: [{ type: 'text', text: 'Step 1' }],
          details: { step: 1 },
          isError: false,
        });
        wrappedUpdate?.({
          content: [{ type: 'text', text: 'Step 2' }],
          details: { step: 2 },
          isError: false,
        });
      });
    });

    it('should accumulate text messages across updates', async () => {
      await teamTool.execute(toolCallId, { tasks: ['t1'] }, undefined, onUpdate, mockCtx);
      // The final onUpdate call should have accumulated history (initial + step1 + step2)
      const lastUpdate = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      // Expect at least initial + step1 + step2
      expect(lastUpdate.content.length).toBeGreaterThanOrEqual(3);
      // Verify all text blocks present
      const texts = lastUpdate.content.map((c: any) => c.text);
      expect(texts).toContain('Step 1');
      expect(texts).toContain('Step 2');
    });
  });

  describe('onUpdate optional behavior', () => {
    const mockTeamOptional = { id: 'team-optional', roles: ['a'] };

    beforeEach(() => {
      bootPiclawTeam.mockResolvedValue(mockTeamOptional);
      executeTeamTasks.mockResolvedValue(undefined);
    });

    it('should work without onUpdate callback (undefined)', async () => {
      // No onUpdate provided
      const result: any = await teamTool.execute(toolCallId, { tasks: ['t1'] }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details?.teamId).toBe('team-optional');
    });

    it('should work with onUpdate callback', async () => {
      const onUpdate = vi.fn();
      const result: any = await teamTool.execute(toolCallId, { tasks: ['t1'] }, undefined, onUpdate, mockCtx);
      expect(result.isError).toBe(false);
      // onUpdate should have been called multiple times
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
