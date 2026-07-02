#!/usr/bin/env node
/**
 * Team Widget: Non-empty Teams Rendering
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { registerTeamWidget } from '../extensions/team/team-widget.js';
import { TeamRegistry } from '../extensions/team/team-manager.js';

// Mock pi-coding-agent (types only)
vi.mock('@earendil-works/pi-coding-agent', () => ({}));

// Mock team-manager
vi.mock('../extensions/team/team-manager.js', () => {
  const registry = {
    getAll: vi.fn(),
  };
  registry.getAll.mockReturnValue(new Map());
  return {
    AgentTeam: class AgentTeam {},
    TeamRegistry: {
      getInstance: vi.fn().mockReturnValue(registry),
    },
  };
});

function createMockUIContext() {
  class Styled {
    constructor(public text: string) {}
    bold() { return this; }
    toString() { return this.text; }
  }
  return {
    theme: {
      fg: (color: string, s: string) => new Styled(s),
    },
    setWidget: vi.fn(),
  };
}

function createMockExtensionContext() {
  return { ui: createMockUIContext() } as any;
}

describe('Team Widget with Teams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders team status when one team exists', async () => {
    const registryInstance = TeamRegistry.getInstance();
    const mockTeam = { getTeamStatus: vi.fn() };
    registryInstance.getAll.mockReturnValue(new Map([['team1', mockTeam]]));

    mockTeam.getTeamStatus.mockResolvedValue({
      agents: [
        { id: 'agent-1', currentTaskIndex: 0, status: 'idle' },
        { id: 'agent-2', currentTaskIndex: 1, status: 'working' },
      ],
      tasks: [
        { index: 0, assignee: 'agent-1', status: 'pending', result: '', retryCount: 0 },
        { index: 1, assignee: 'agent-2', status: 'in_progress', result: '', retryCount: 0 },
      ],
      completedTasks: 0,
      failedTasks: 0,
      pendingTasks: 1,
      totalTasks: 2,
      isComplete: false,
    });

    const api = { on: vi.fn() } as any;
    registerTeamWidget(api);
    const sessionStartCall = api.on.mock.calls.find(([name]) => name === 'session_start');
    const startHandler = sessionStartCall[1] as Function;
    const ctx = createMockExtensionContext();
    startHandler(null, ctx);

    // Wait for async getTeamStatus to resolve
    await Promise.resolve();

    const calls = ctx.ui.setWidget.mock.calls;
    let teamLines: any[] | undefined;
    for (const call of calls) {
      const arg = call[1];
      if (Array.isArray(arg) && arg.some((line: any) => line.toString().includes('Team'))) {
        teamLines = arg;
        break;
      }
    }
    expect(teamLines).toBeDefined();
    if (teamLines) {
      const teamLine = teamLines.find((line: any) => line.toString().includes('team1'));
      expect(teamLine).toBeDefined();
      const tasksLine = teamLines.find((line: any) => line.toString().includes('Tasks: 0/2'));
      expect(tasksLine).toBeDefined();
    }
  });
});
