#!/usr/bin/node
/**
 * Team Command Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { registerTeamCommand } from '../extensions/commands/team-command.js';
import { toggleTeamWidget, getTeamWidgetEnabled } from '../extensions/team/team-widget.js';

// Mock pi-coding-agent to avoid real imports
vi.mock('@earendil-works/pi-coding-agent', () => ({
  // Minimal exports; we only need types (erased)
}));

// Mock team-manager
vi.mock('../extensions/team/team-manager.js', () => ({
  AgentTeam: class AgentTeam {},
  TeamRegistry: {
    getInstance: vi.fn().mockReturnValue({
      getAll: vi.fn().mockReturnValue(new Map()),
    }),
  },
}));

// Mock team-widget functions (override actual implementation)
vi.mock('../extensions/team/team-widget.js', () => ({
  toggleTeamWidget: vi.fn().mockReturnValue(true),
  getTeamWidgetEnabled: vi.fn().mockReturnValue(true),
}));

function createMockAPI() {
  return { registerCommand: vi.fn() } as any;
}
function createMockContext() {
  return { ui: { notify: vi.fn() } } as any;
}

describe('Team Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers /team command', () => {
    const api = createMockAPI();
    registerTeamCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith(
      'team',
      expect.objectContaining({
        description: expect.stringContaining('Toggle team status widget'),
        handler: expect.any(Function),
      })
    );
  });

  it('handler toggles widget and notifies shown', async () => {
    const api = createMockAPI();
    registerTeamCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    const ctx = createMockContext();

    // Configure mocks: current state disabled, toggle returns enabled
    getTeamWidgetEnabled.mockReturnValue(false);
    toggleTeamWidget.mockReturnValue(true);

    await handler('', ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('Team widget shown', 'info');
  });

  it('handler toggles off and notifies hidden', async () => {
    const api = createMockAPI();
    registerTeamCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    const ctx = createMockContext();

    getTeamWidgetEnabled.mockReturnValue(true);
    toggleTeamWidget.mockReturnValue(false);

    await handler('', ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('Team widget hidden', 'info');
  });
});
