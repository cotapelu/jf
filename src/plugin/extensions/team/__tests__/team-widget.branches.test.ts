#!/usr/bin/env node
/**
 * Branch coverage for team-widget
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mocks for team-manager
const mockTeam = {
  getTeamStatus: vi.fn()
};

const mockRegistry = {
  getAll: vi.fn()
};

vi.mock('../team-manager.js', () => {
  return {
    TeamRegistry: {
      getInstance: vi.fn(() => ({
        getAll: mockRegistry.getAll
      }))
    },
    AgentTeam: {}
  };
});

import {
  buildHeaderLines,
  buildTeamLines,
  refreshWidget,
  startWidget,
  stopWidget,
  toggleTeamWidget,
  getTeamWidgetEnabled
} from '../team-widget.js';

describe('team-widget branch coverage', () => {
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTeam.getTeamStatus.mockResolvedValue({
      agents: [],
      tasks: [],
      completedTasks: 0,
      failedTasks: 0,
      pendingTasks: 0,
      totalTasks: 0,
      isComplete: true
    });
    mockRegistry.getAll.mockReturnValue(new Map());
    ctx = {
      ui: {
        setWidget: vi.fn(),
        theme: { fg: (style: string, text: string) => text }
      }
    };
  });

  afterEach(() => {
    // Clean up any interval that might have been set
    vi.useRealTimers();
  });

  describe('buildHeaderLines', () => {
    it('constructs header with accent style', () => {
      const theme = { fg: (style: string, text: string) => `[${style}]${text}` } as any;
      const lines = buildHeaderLines(theme);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('Team');
      expect(lines[1]).toBe('');
    });
  });

  describe('buildTeamLines', () => {
    it('formats team status with agent breakdown', () => {
      const status = {
        agents: [
          { id: 'a1', currentTaskIndex: null, status: 'idle' },
          { id: 'a2', currentTaskIndex: 0, status: 'working' },
          { id: 'a3', currentTaskIndex: 1, status: 'in_progress' }
        ],
        tasks: [
          { index: 0, assignee: 'a2', status: 'in_progress' as const, result: '', retryCount: 0 },
          { index: 1, assignee: 'a3', status: 'pending' as const, result: '', retryCount: 0 }
        ],
        completedTasks: 0,
        failedTasks: 0,
        pendingTasks: 1,
        totalTasks: 2,
        isComplete: false
      };
      const ui = { theme: { fg: (s: string, t: string) => t } } as any;
      const lines = buildTeamLines(ui, 'team-123', status);
      const shortId = 'team-123'.slice(-6);
      expect(lines[0]).toBe(`Team ${shortId}`);
      expect(lines).toContain('  Tasks: 0/2 (pending: 1, failed: 0)');
      expect(lines).toContain('  Agents: 3 (idle: 1, working: 2)');
    });
  });

  describe('refreshWidget', () => {
    it('sets "No active teams" when registry empty', async () => {
      mockRegistry.getAll.mockReturnValue(new Map());
      await refreshWidget(ctx.ui);
      expect(ctx.ui.setWidget).toHaveBeenCalledWith('team', expect.arrayContaining([
        expect.stringContaining('No active teams')
      ]));
    });

    it('handles exception from registry', async () => {
      mockRegistry.getAll.mockImplementation(() => { throw new Error('fail'); });
      await refreshWidget(ctx.ui);
      // Should not throw; setWidget might not be called
      expect(ctx.ui.setWidget).not.toHaveBeenCalled();
    });

    it('renders single team successfully', async () => {
      const teamMap = new Map<string, any>([
        ['t1', mockTeam]
      ]);
      mockRegistry.getAll.mockReturnValue(teamMap);
      mockTeam.getTeamStatus.mockResolvedValue({
        agents: [{ id: 'a1', currentTaskIndex: null, status: 'idle' }],
        tasks: [],
        completedTasks: 0,
        failedTasks: 0,
        pendingTasks: 0,
        totalTasks: 0,
        isComplete: true
      });
      await refreshWidget(ctx.ui);
      expect(ctx.ui.setWidget).toHaveBeenCalledWith('team', expect.arrayContaining([
        expect.stringContaining('Team t1')
      ]));
    });

    it('renders error when getTeamStatus fails', async () => {
      const teamMap = new Map<string, any>([
        ['t1', mockTeam]
      ]);
      mockRegistry.getAll.mockReturnValue(teamMap);
      mockTeam.getTeamStatus.mockRejectedValue(new Error('fail'));
      await refreshWidget(ctx.ui);
      expect(ctx.ui.setWidget).toHaveBeenCalledWith('team', expect.arrayContaining([
        expect.stringContaining('error fetching status')
      ]));
    });

    it('waits for all teams before setting widget', async () => {
      const team1 = { getTeamStatus: vi.fn().mockResolvedValue({ agents: [], tasks: [], completedTasks: 0, failedTasks: 0, pendingTasks: 0, totalTasks: 0, isComplete: true }) };
      const team2 = { getTeamStatus: vi.fn().mockResolvedValue({ agents: [], tasks: [], completedTasks: 0, failedTasks: 0, pendingTasks: 0, totalTasks: 0, isComplete: true }) };
      const teamMap = new Map<string, any>([
        ['t1', team1],
        ['t2', team2]
      ]);
      mockRegistry.getAll.mockReturnValue(teamMap);
      await refreshWidget(ctx.ui);
      // setWidget should be called once after both complete
      expect(ctx.ui.setWidget).toHaveBeenCalledTimes(1);
    });

    it('handles mixed success and failure', async () => {
      const team1 = { getTeamStatus: vi.fn().mockResolvedValue({ agents: [], tasks: [], completedTasks: 0, failedTasks: 0, pendingTasks: 0, totalTasks: 0, isComplete: true }) };
      const team2 = { getTeamStatus: vi.fn().mockRejectedValue(new Error('fail')) };
      const teamMap = new Map<string, any>([
        ['t1', team1],
        ['t2', team2]
      ]);
      mockRegistry.getAll.mockReturnValue(teamMap);
      await refreshWidget(ctx.ui);
      expect(ctx.ui.setWidget).toHaveBeenCalledWith('team', expect.arrayContaining([
        expect.stringContaining('Team t1'),
        expect.stringContaining('error fetching status')
      ]));
    });
  });

  describe('startWidget', () => {
    it('starts widget and calls initial refresh', () => {
      const setWidgetSpy = vi.spyOn(ctx.ui, 'setWidget');
      startWidget(ctx);
      expect(setWidgetSpy).toHaveBeenCalled();
    });

    it('does not start again if already running', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      startWidget(ctx);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      startWidget(ctx);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopWidget', () => {
    it('stops interval and clears widget', () => {
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');
      // Create a fake state; intervalId can be any number
      const fakeState = { enabled: false, ctx, intervalId: 123 as any };
      stopWidget(fakeState);
      expect(clearSpy).toHaveBeenCalledWith(123);
      expect(ctx.ui.setWidget).toHaveBeenCalledWith('team', undefined);
      expect(fakeState.ctx).toBeNull();
      clearSpy.mockRestore();
    });

    it('handles null interval gracefully', () => {
      const fakeState = { enabled: false, ctx, intervalId: null };
      expect(() => stopWidget(fakeState)).not.toThrow();
    });
  });

  describe('toggleTeamWidget', () => {
    it('toggles from default enabled to disabled', () => {
      const enabled = toggleTeamWidget(ctx);
      expect(enabled).toBe(false);
      expect(getTeamWidgetEnabled(ctx)).toBe(false);
    });

    it('toggles back to enabled', () => {
      toggleTeamWidget(ctx); // -> false
      const enabled = toggleTeamWidget(ctx); // -> true
      expect(enabled).toBe(true);
      expect(getTeamWidgetEnabled(ctx)).toBe(true);
    });
  });

  describe('getTeamWidgetEnabled', () => {
    it('returns true when no state', () => {
      expect(getTeamWidgetEnabled(ctx)).toBe(true);
    });
  });
});
