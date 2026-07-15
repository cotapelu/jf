import { createTeamTool } from '../team-tool.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamRegistry } from '../team-manager.js';
import type { AgentToolResult, ExtensionContext } from '@earendil-works/pi-coding-agent';

// Mock team manager functions
vi.mock('../team-manager.js', async () => {
  const actual = await vi.importActual('../team-manager.js');
  return {
    ...actual,
    bootPiclawTeam: vi.fn(),
    executeTeamTasks: vi.fn(),
  };
});

const mockCtx: ExtensionContext = {
  runtime: { session: { sessionId: 'test-session' } },
  session: { sessionId: 'test-session' },
};

describe('team_run tool - comprehensive coverage', () => {
  const tool = createTeamTool();
  const toolCallId = 'test-call-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parameter validation', () => {
    it('should reject call reference strings with clear error', async () => {
      const result: AgentToolResult<any> = await tool.execute(toolCallId, 'call_abc123', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('call reference');
      expect(result.details?.error).toBe('Unresolved call reference');
    });

    it('should reject invalid JSON strings', async () => {
      const result: AgentToolResult<any> = await tool.execute(toolCallId, 'not valid json', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Invalid JSON');
    });

    it('should reject object without tasks array', async () => {
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { teamSize: 2 }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tasks must be a non-empty array');
    });

    it('should reject empty tasks array', async () => {
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: [] }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tasks must be a non-empty array');
    });

    it('should accept valid object with tasks (may fail later due to runtime)', async () => {
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: ['ls'], teamSize: 1 }, undefined, undefined, mockCtx);
      // Should NOT have param validation errors
      expect(result.details?.error).not.toBe('Invalid JSON');
      expect(result.details?.error).not.toBe('Unresolved call reference');
    });

    it('should reject non-object/non-string params', async () => {
      // @ts-ignore - testing runtime type handling
      const result: AgentToolResult<any> = await tool.execute(toolCallId, 12345, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Invalid parameters');
    });

    it('should reject tasks that is not an array', async () => {
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: 'not an array' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tasks must be a non-empty array');
    });
  });

  describe('JSON string parsing', () => {
    it('should parse valid JSON string param', async () => {
      const result: AgentToolResult<any> = await tool.execute(toolCallId, '{"tasks": ["ls"], "teamSize": 1}', undefined, undefined, mockCtx);
      expect(result.details?.error).not.toBe('Invalid JSON');
    });
  });

  describe('team query (teamId provided)', () => {
    it('should return error if team not found', async () => {
      const registry = TeamRegistry.getInstance();
      vi.spyOn(registry, 'get').mockReturnValue(undefined);
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { teamId: 'nonexistent' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should return status if team found', async () => {
      const mockTeam = { id: 'team-123', getTeamStatus: vi.fn().mockResolvedValue({ completedTasks: 2, totalTasks: 5, agents: [{ id: 'a1' }, { id: 'a2' }] }) };
      const registry = TeamRegistry.getInstance();
      vi.spyOn(registry, 'get').mockReturnValue(mockTeam);
      const resetSpy = vi.spyOn(registry, 'resetAutoDisposeTimer');
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { teamId: 'team-123' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details?.teamId).toBe('team-123');
      expect(result.content[0].text).toContain('Team team-123 status');
      expect(resetSpy).toHaveBeenCalledWith('team-123');
    });
  });

  describe('new team creation', () => {
    it('should fail if runtime context is missing', async () => {
      const badCtx: ExtensionContext = { runtime: undefined, session: undefined };
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: ['ls'] }, undefined, undefined, badCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No runtime context available');
    });

    it('should succeed and return teamId when execution succeeds', async () => {
      const mockTeam = { id: 'new-team-456', roles: ['planner','coder'] };
      const { bootPiclawTeam, executeTeamTasks } = await import('../team-manager.js');
      vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
      vi.mocked(executeTeamTasks).mockResolvedValue(undefined);
      const updates: AgentToolResult<any>[] = [];
      const onUpdate = (update: AgentToolResult<any>) => updates.push(update);
      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: ['task1','task2'], teamSize: 2 }, undefined, onUpdate, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details?.teamId).toBe('new-team-456');
      expect(result.content[0].text).toContain('Team started');
      expect(bootPiclawTeam).toHaveBeenCalled();
      expect(executeTeamTasks).toHaveBeenCalledWith(mockTeam, ['task1','task2'], expect.any(Function), {});
      expect(updates.length).toBe(2);
    });

    it('should handle executeTeamTasks failure and report error', async () => {
      const { bootPiclawTeam, executeTeamTasks } = await import('../team-manager.js');
      vi.mocked(bootPiclawTeam).mockResolvedValue({ id: 'team-fail', roles: ['tester'] });
      vi.mocked(executeTeamTasks).mockRejectedValue(new Error('execution failed'));

      const updates: AgentToolResult<any>[] = [];
      const onUpdate = (update: AgentToolResult<any>) => updates.push(update);

      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: ['task1'] }, undefined, onUpdate, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Team execution failed');
      expect(result.details?.error).toBe('execution failed');
      // Should also have sent error update via onUpdate
      const errorUpdates = updates.filter(u => u.isError);
      expect(errorUpdates.length).toBeGreaterThanOrEqual(1);
    });

    it('should accumulate multiple text messages across updates', async () => {
      const mockTeam = { id: 'acc-team', roles: ['a'] };
      const { bootPiclawTeam, executeTeamTasks } = await import('../team-manager.js');
      vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
      vi.mocked(executeTeamTasks).mockImplementation(async (team, tasks, onUpdate) => {
        onUpdate({ content: [{ type: 'text', text: 'Step 1' }], isError: false });
        onUpdate({ content: [{ type: 'text', text: 'Step 2' }], isError: false });
        onUpdate({ content: [{ type: 'text', text: 'Step 3' }], isError: false });
      });
      const accumulated: AgentToolResult<any>[] = [];
      const onUpdate = (update: AgentToolResult<any>) => accumulated.push(update);
      await tool.execute(toolCallId, { tasks: ['t1'] }, undefined, onUpdate, mockCtx);
      expect(accumulated.length).toBe(5);
      expect(accumulated[4].content).toHaveLength(5);
      expect(accumulated[4].content[4].text).toBe('Step 3');
      expect(accumulated[2].content).toHaveLength(3);
      expect(accumulated[2].content[2].text).toBe('Step 1');
      expect(accumulated[3].content).toHaveLength(4);
      expect(accumulated[3].content[3].text).toBe('Step 2');
    });

    it('should work when onUpdate is undefined (no accumulation)', async () => {
      const mockTeam = { id: 'no-update-team', roles: ['a'] };
      const { bootPiclawTeam, executeTeamTasks } = await import('../team-manager.js');
      vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
      vi.mocked(executeTeamTasks).mockResolvedValue(undefined);

      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: ['t1'] }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Team started');
    });

    it('should include teamId in final result details', async () => {
      const mockTeam = { id: 'details-team', roles: ['r'] };
      vi.mocked(await import('../team-manager.js')).bootPiclawTeam.mockResolvedValue(mockTeam);
      vi.mocked(await import('../team-manager.js')).executeTeamTasks.mockResolvedValue(undefined);

      const result: AgentToolResult<any> = await tool.execute(toolCallId, { tasks: ['t'] }, undefined, undefined, mockCtx);
      expect(result.details?.teamId).toBe('details-team');
      expect(result.details?.status).toBe('running');
    });
  });
});
