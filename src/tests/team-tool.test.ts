import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamTool } from '../extensions/team/team-tool.js';
import { bootPiclawTeam, executeTeamTasks, TeamRegistry } from '../extensions/team/team-manager.js';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

// Mock the team manager module
vi.mock('../extensions/team/team-manager.js', () => ({
  bootPiclawTeam: vi.fn().mockResolvedValue({
    id: 'team123',
    roles: ['planner', 'coder'],
  }),
  executeTeamTasks: vi.fn().mockResolvedValue(undefined),
  TeamRegistry: {
    getInstance: vi.fn().mockReturnValue({
      get: vi.fn(),
      resetAutoDisposeTimer: vi.fn(),
    }),
  },
}));

describe('Team Tool', () => {
  let tool: ReturnType<typeof createTeamTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = createTeamTool();
  });

  const mockCtx: ExtensionContext = { runtime: {} as any }; // runtime minimally typed; cast ok

  it('should reject call reference string', async () => {
    const invalidParam: any = 'call_abc123';
    const result = await tool.execute('call1', invalidParam, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('call reference');
  });

  it('should reject invalid JSON string', async () => {
    const invalidParam: any = '{ invalid }';
    const result = await tool.execute('call2', invalidParam, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid JSON');
  });

  it('should reject non-object, non-string params', async () => {
    // @ts-expect-edge - testing invalid param type
    const invalidParam: any = 123;
    const result = await tool.execute('call3', invalidParam, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid parameters');
  });

  it('should require tasks when creating new team', async () => {
    const result = await tool.execute('call4', {}, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });

  it('should reject empty tasks array', async () => {
    const result = await tool.execute('call5', { tasks: [] }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });

  it('should fail when no runtime context', async () => {
    const emptyCtx: any = {};
    const result = await tool.execute('call6', { tasks: ['t1'] }, undefined, undefined, emptyCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No runtime context available');
  });

  it('should create team successfully', async () => {
    const result = await tool.execute('call7', { tasks: ['t1', 't2'] }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details).toHaveProperty('teamId');
    // Should pass through undefined teamSize and teamRoles (boot team handles defaults)
    expect(bootPiclawTeam).toHaveBeenCalledWith(mockCtx.runtime, { teamSize: undefined, teamRoles: undefined });
  });

  it('should create team with custom size and roles', async () => {
    const result = await tool.execute('call8', { tasks: ['t1'], teamSize: 3, teamRoles: ['planner'] }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(false);
    expect(bootPiclawTeam).toHaveBeenCalledWith(mockCtx.runtime, { teamSize: 3, teamRoles: ['planner'] });
  });

  it('should query existing team status', async () => {
    const fakeTeam: any = {
      getTeamStatus: async () => ({ completedTasks: 1, totalTasks: 3, agents: [] }),
    };
    TeamRegistry.getInstance().get = vi.fn(() => fakeTeam);
    const result = await tool.execute('call9', { teamId: 'team123' }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Team team123 status');
  });

  it('should handle non-existent team query', async () => {
    TeamRegistry.getInstance().get = vi.fn(() => null);
    const result = await tool.execute('call10', { teamId: 'unknown' }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('should handle boot failure', async () => {
    bootPiclawTeam.mockRejectedValueOnce(new Error('Boot failed'));
    const result = await tool.execute('call11', { tasks: ['t1'] }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Team execution failed: Boot failed');
  });

  it('should handle non-Error rejection', async () => {
    bootPiclawTeam.mockRejectedValueOnce('non-error');
    const result = await tool.execute('call13', { tasks: ['t1'] }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('non-error');
  });

  it('should accumulate onUpdate messages when callback provided', async () => {
    const onUpdate = vi.fn();
    const result = await tool.execute('call12', { tasks: ['t1'] }, undefined, onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    // onUpdate should have been called at least once (initial startup update)
    expect(onUpdate).toHaveBeenCalled();
  });
});
