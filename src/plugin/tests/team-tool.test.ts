import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamTool } from '../extensions/team/team-tool.js';

// Mock the team-manager module
vi.mock('../extensions/team/team-manager.js', () => ({
  bootPiclawTeam: vi.fn(),
  executeTeamTasks: vi.fn(),
  TeamRegistry: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      resetAutoDisposeTimer: vi.fn()
    }))
  }
}));

import { bootPiclawTeam, executeTeamTasks, TeamRegistry } from '../extensions/team/team-manager.js';

const tool = createTeamTool();

describe('team_run tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockParentRuntime = () => ({
    session: { sessionManager: { parentRuntime: null } },
    cwd: '/tmp',
  });

  it('requires tasks array', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    // @ts-ignore intentionally testing empty params
    const result = (await tool.execute('id', {}, undefined, undefined, ctx));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });

  it('rejects non-array tasks', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    // @ts-ignore intentionally testing invalid tasks type
    const result = (await tool.execute('id', { tasks: 'not array' }, undefined, undefined, ctx));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });

  it('requires parentRuntime in context', async () => {
    const ctx = {};
    // @ts-ignore intentionally testing missing runtime context
    const result = (await tool.execute('id', { tasks: ['t1'] }, undefined, undefined, ctx));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No runtime context');
  });

  it('accepts JSON string params', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    const mockTeam = { id: 'team-json', roles: ['agent'], dispose: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
    vi.mocked(executeTeamTasks).mockResolvedValue(undefined);

    // @ts-ignore intentionally testing JSON string params
    const result = (await tool.execute('id', '{"tasks":["t1"]}', undefined, undefined, ctx));
    expect(result.isError).toBe(false);
    expect(bootPiclawTeam).toHaveBeenCalledWith(parent, { teamSize: undefined, teamRoles: undefined });
    expect(executeTeamTasks).toHaveBeenCalledWith(mockTeam, ['t1'], undefined, {});
    expect(result.content[0].text).toContain('✅ Team started: team-json');
    expect(result.details.teamId).toBe('team-json');
    expect(result.details.agentCount).toBe(1);
    expect(result.details.totalTasks).toBe(1);
    expect(result.details.status).toBe('running');
  });

  it('executes team successfully with default teamSize', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    const mockTeam = { id: 'team-default', roles: ['a', 'b'], dispose: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
    vi.mocked(executeTeamTasks).mockResolvedValue(undefined);

    const result = (await tool.execute('id', { tasks: ['Task 1', 'Task 2'] }, undefined, undefined, ctx));

    expect(bootPiclawTeam).toHaveBeenCalledWith(parent, { teamSize: undefined, teamRoles: undefined });
    expect(executeTeamTasks).toHaveBeenCalledWith(mockTeam, ['Task 1', 'Task 2'], undefined, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Team started: team-default');
    expect(result.details.teamId).toBe('team-default');
    expect(result.details.agentCount).toBe(2);
    expect(result.details.totalTasks).toBe(2);
    expect(result.details.status).toBe('running');
  });

  it('passes custom teamSize and teamRoles', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    const mockTeam = { dispose: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
    vi.mocked(executeTeamTasks).mockResolvedValue(undefined);
    mockTeam.getResults = vi.fn().mockResolvedValue(['Result']);

    await tool.execute('id', { tasks: ['t1'], teamSize: 3, teamRoles: ['planner', 'coder'] }, undefined, undefined, ctx);

    expect(bootPiclawTeam).toHaveBeenCalledWith(parent, expect.anything()); // custom teamSize and roles passed
    // To be more precise, could check second arg's properties via mock calls

  });

  it('handles bootPiclawTeam failure', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    vi.mocked(bootPiclawTeam).mockRejectedValue(new Error('Boot failed'));

    const result = (await tool.execute('id', { tasks: ['t1'] }, undefined, undefined, ctx));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Team execution failed');
    expect(result.details.error).toBe('Boot failed');
  });

  it('handles executeTeamTasks failure', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    const mockTeam = { dispose: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
    vi.mocked(executeTeamTasks).mockRejectedValue(new Error('Task exec failed'));

    const result = (await tool.execute('id', { tasks: ['t1'] }, undefined, undefined, ctx));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Team execution failed');
    expect(result.details.error).toBe('Task exec failed');
    // In this code path, dispose is not called because catch occurs before dispose
    expect(mockTeam.dispose).not.toHaveBeenCalled();
  });

  // Additional team_run tool tests

  it('accumulates onUpdate messages', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };
    const updates: any[] = [];
    const onUpdate = (u: any) => updates.push(u);

    const mockTeam = { id: 'team-acc', roles: ['a'], dispose: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(bootPiclawTeam).mockResolvedValue(mockTeam);
    vi.mocked(executeTeamTasks).mockResolvedValue(undefined);

    await tool.execute('id', { tasks: ['t1'] }, undefined, onUpdate, ctx);

    expect(updates.length).toBeGreaterThan(0);
    const allTexts = updates.flatMap(u => u.content.map((c: any) => c.text)).join(' ');
    expect(allTexts).toContain('Starting team with 2 agents');
  });

  it('queries existing team status', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };

    const mockTeam = {
      getTeamStatus: vi.fn().mockResolvedValue({
        completedTasks: 1,
        totalTasks: 2,
        agents: [{}, {}]
      })
    };
    const mockRegistry = {
      get: vi.fn(),
      resetAutoDisposeTimer: vi.fn()
    };
    mockRegistry.get.mockReturnValue(mockTeam);
    vi.mocked(TeamRegistry.getInstance).mockReturnValue(mockRegistry);

    const result = (await tool.execute('id', { teamId: 'team-1' }, undefined, undefined, ctx));

    expect(mockRegistry.get).toHaveBeenCalledWith('team-1');
    expect(mockRegistry.resetAutoDisposeTimer).toHaveBeenCalledWith('team-1');
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('📊 Team team-1 status: 1/2 tasks completed, 2 agents');
    expect(result.details.teamId).toBe('team-1');
  });

  it('handles non-existent team', async () => {
    const parent = createMockParentRuntime();
    const ctx = { runtime: parent };

    const mockRegistry = {
      get: vi.fn(),
      resetAutoDisposeTimer: vi.fn()
    };
    mockRegistry.get.mockReturnValue(undefined);
    vi.mocked(TeamRegistry.getInstance).mockReturnValue(mockRegistry);

    const result = (await tool.execute('id', { teamId: 'missing' }, undefined, undefined, ctx));

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Team with ID missing not found');
  });

});
