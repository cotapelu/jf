import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Declare var (hoisted, undefined initially). Mock factory will assign.
var mockRegistryInstance: any;

// Mock team-manager's TeamRegistry
vi.mock('../team-manager.js', () => {
  mockRegistryInstance = {
    getAll: vi.fn(() => new Map()),
  };
  return {
    TeamRegistry: {
      getInstance: vi.fn(() => mockRegistryInstance),
    },
  };
});

import * as teamWidget from '../team-widget.js';

// Helper to create mock ExtensionContext
function createMockContext(overrides: Partial<ExtensionContext> = {}): ExtensionContext {
  return {
    ui: {
      setWidget: vi.fn(),
      theme: {
        fg: (_color: string, text: string) => text,
        bold: (text: string) => text,
      },
    } as any,
    session: { cwd: process.cwd() },
    ...overrides,
  } as unknown as ExtensionContext;
}

describe('team-widget', () => {
  let context: ExtensionContext;

  beforeEach(() => {
    vi.useFakeTimers();
    context = createMockContext();
    // Reset mock registry to empty map
    mockRegistryInstance.getAll.mockReturnValue(new Map());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getTeamWidgetEnabled', () => {
    it('returns true when no state (default)', () => {
      expect(teamWidget.getTeamWidgetEnabled(context)).toBe(true);
    });

    it('returns false after toggling off', () => {
      teamWidget.toggleTeamWidget(context);
      expect(teamWidget.getTeamWidgetEnabled(context)).toBe(false);
    });
  });

  describe('toggleTeamWidget', () => {
    it('toggles from true to false', () => {
      expect(teamWidget.getTeamWidgetEnabled(context)).toBe(true);
      expect(teamWidget.toggleTeamWidget(context)).toBe(false);
    });

    it('toggles from false to true', () => {
      teamWidget.toggleTeamWidget(context); // true -> false
      expect(teamWidget.toggleTeamWidget(context)).toBe(true);
    });
  });

  describe('registerTeamWidget', () => {
    it('registers session_start listener immediately', () => {
      const api = { on: vi.fn() };
      teamWidget.registerTeamWidget(api);
      expect(api.on).toHaveBeenCalledWith('session_start', expect.any(Function));
      // session_shutdown is registered later inside the session_start handler
      expect(api.on).not.toHaveBeenCalledWith('session_shutdown', expect.anything());
    });

    it('on session_start, registers session_shutdown and calls startWidget', async () => {
      const api = { on: vi.fn() };
      let sessionStartCb!: Function;
      let shutdownCb!: Function;
      api.on = vi.fn((event: string, cb: any) => {
        if (event === 'session_start') sessionStartCb = cb;
        if (event === 'session_shutdown') shutdownCb = cb;
      });
      teamWidget.registerTeamWidget(api);
      // Verify initial registration only session_start
      expect(api.on).toHaveBeenCalledWith('session_start', expect.any(Function));
      // Trigger session_start
      await sessionStartCb(undefined, context);
      // After session_start, the handler should have registered session_shutdown
      expect(api.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
      // Wait for refreshWidget's promise chain
      await Promise.resolve();
      // refreshWidget should have called setWidget
      expect(context.ui.setWidget).toHaveBeenCalled();
    });

    it('on session_shutdown, stops widget and cleans state', async () => {
      const api = { on: vi.fn() };
      let sessionStartCb!: Function;
      let shutdownCb!: Function;
      api.on = vi.fn((event: string, cb: any) => {
        if (event === 'session_start') sessionStartCb = cb;
        if (event === 'session_shutdown') shutdownCb = cb;
      });
      teamWidget.registerTeamWidget(api);
      await sessionStartCb(undefined, context);
      await Promise.resolve();
      // Now trigger shutdown
      await shutdownCb();
      // Should have removed widget
      expect(context.ui.setWidget).toHaveBeenCalledWith('team', undefined);
    });
  });

  describe('refreshWidget behavior (through startWidget)', () => {
    it('shows "No active teams" when registry empty', async () => {
      mockRegistryInstance.getAll.mockReturnValue(new Map());
      const api = { on: vi.fn() };
      let sessionStartCb!: Function;
      api.on = vi.fn((e: string, cb: any) => {
        if (e === 'session_start') sessionStartCb = cb;
      });
      teamWidget.registerTeamWidget(api);
      await sessionStartCb(undefined, context);
      await Promise.resolve();
      expect(context.ui.setWidget).toHaveBeenCalledWith(
        'team',
        expect.arrayContaining([expect.stringContaining('No active teams')])
      );
    });

    it('renders team status when registry returns a team', async () => {
      const fakeTeam = {
        getTeamStatus: vi.fn().mockResolvedValue({
          agents: [],
          tasks: [],
          completedTasks: 1,
          failedTasks: 0,
          pendingTasks: 0,
          totalTasks: 1,
          isComplete: true,
        }),
      };
      mockRegistryInstance.getAll.mockReturnValue(new Map([['t1', fakeTeam]]));
      const api = { on: vi.fn() };
      let sessionStartCb!: Function;
      api.on = vi.fn((e: string, cb: any) => {
        if (e === 'session_start') sessionStartCb = cb;
      });
      teamWidget.registerTeamWidget(api);
      await sessionStartCb(undefined, context);
      await Promise.resolve();
      // Check that setWidget was called with lines containing "Team"
      const calls = context.ui.setWidget as any;
      const lastCall = calls.mock.calls[calls.mock.calls.length - 1];
      const lines = lastCall[1];
      expect(lines.some((l: string) => l.includes('Team'))).toBe(true);
    });
  });

  describe('periodic refresh', () => {
    it('triggers refreshWidget on interval after start', async () => {
      const fakeTeam = {
        getTeamStatus: vi.fn().mockResolvedValue({
          agents: [],
          tasks: [],
          completedTasks: 0,
          failedTasks: 0,
          pendingTasks: 0,
          totalTasks: 0,
          isComplete: true,
        }),
      };
      mockRegistryInstance.getAll.mockReturnValue(new Map([['t1', fakeTeam]]));
      const api = { on: vi.fn() };
      let sessionStartCb!: Function;
      api.on = vi.fn((e: string, cb: any) => {
        if (e === 'session_start') sessionStartCb = cb;
      });
      teamWidget.registerTeamWidget(api);
      await sessionStartCb(undefined, context);
      await Promise.resolve(); // initial refreshWidget
      const before = (context.ui.setWidget as any).mock.calls.length;
      // Advance past interval (2000ms)
      await vi.advanceTimersByTimeAsync(2500);
      // Wait for microtasks from refreshWidget promise
      await Promise.resolve();
      const after = (context.ui.setWidget as any).mock.calls.length;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('error handling', () => {
    it('handles team getTeamStatus rejection and shows error line', async () => {
      const fakeTeam = {
        getTeamStatus: vi.fn().mockRejectedValue(new Error('down')),
      };
      mockRegistryInstance.getAll.mockReturnValue(new Map([['t1', fakeTeam]]));
      const api = { on: vi.fn() };
      let sessionStartCb!: Function;
      api.on = vi.fn((e: string, cb: any) => {
        if (e === 'session_start') sessionStartCb = cb;
      });
      teamWidget.registerTeamWidget(api);
      await sessionStartCb(undefined, context);
      await Promise.resolve();
      // Expect error line in widget output
      const calls = context.ui.setWidget as any;
      const lastCall = calls.mock.calls[calls.mock.calls.length - 1];
      const lines = lastCall[1];
      expect(lines.some((l: string) => l.includes('error fetching status'))).toBe(true);
    });
  });
});
