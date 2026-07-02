#!/usr/bin/env node
/**
 * Team Widget Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock pi-coding-agent (only types, but we can provide minimal values)
vi.mock('@earendil-works/pi-coding-agent', () => ({
  // no runtime exports needed for these tests
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

// Import widget functions after mocks
import {
  toggleTeamWidget,
  getTeamWidgetEnabled,
  registerTeamWidget,
} from '../extensions/team/team-widget.js';

function createMockUIContext(theme = {}) {
  class Styled {
    constructor(public text: string) {}
    bold() { return this; }
    toString() { return this.text; }
  }
  return {
    theme: {
      fg: (color: string, s: string) => new Styled(s),
      ...theme,
    },
    setWidget: vi.fn(),
  };
}

function createMockExtensionContext() {
  return {
    ui: createMockUIContext(),
  } as any;
}

describe('Team Widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleTeamWidget', () => {
    it('toggles from default enabled to disabled', () => {
      const ctx = createMockExtensionContext();
      expect(getTeamWidgetEnabled(ctx)).toBe(true); // default

      const result = toggleTeamWidget(ctx);
      expect(result).toBe(false);
      expect(getTeamWidgetEnabled(ctx)).toBe(false);
    });

    it('toggles back to enabled', () => {
      const ctx = createMockExtensionContext();
      toggleTeamWidget(ctx); // false
      const result = toggleTeamWidget(ctx);
      expect(result).toBe(true);
    });
  });

  describe('getTeamWidgetEnabled', () => {
    it('returns true when no state present (default)', () => {
      const ctx = createMockExtensionContext();
      expect(getTeamWidgetEnabled(ctx)).toBe(true);
    });
  });

  describe('registerTeamWidget', () => {
    it('sets up session_start and session_shutdown handlers', () => {
      const api = { on: vi.fn() } as any;
      registerTeamWidget(api);
      expect(api.on).toHaveBeenCalledWith('session_start', expect.any(Function));
      // Inside session_start, it also registers session_shutdown via api.on
      // We'll simulate session_start and check that startWidget was called (by checking that setWidget called initially)
      const sessionStartCall = api.on.mock.calls.find(([name]) => name === 'session_start');
      expect(sessionStartCall).toBeDefined();
      const handler = sessionStartCall[1] as Function;
      const ctx = createMockExtensionContext();
      handler(null, ctx);

      // After session_start, ui.setWidget should have been called (initial refresh)
      expect(ctx.ui.setWidget).toHaveBeenCalled();
    });

    it('cleans up on session_shutdown', () => {
      const api = { on: vi.fn() } as any;
      registerTeamWidget(api);
      const sessionStartCall = api.on.mock.calls.find(([name]) => name === 'session_start');
      const startHandler = sessionStartCall[1] as Function;
      const ctx = createMockExtensionContext();
      startHandler(null, ctx);

      // Find session_shutdown handler registration (happened inside session_start)
      expect(api.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
      const shutdownCalls = api.on.mock.calls.filter(([name]) => name === 'session_shutdown');
      const lastShutdownCall = shutdownCalls[shutdownCalls.length - 1];
      const shutdownHandler = lastShutdownCall[1] as Function;
      shutdownHandler(null);

      // After shutdown, widget should be cleared (setWidget with second argument undefined)
      // The second call to setWidget should be with ("team", undefined)
      const calls = ctx.ui.setWidget.mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[1][0]).toBe('team');
      expect(calls[1][1]).toBeUndefined();
    });
  });

  describe('refreshWidget logic (indirect)', () => {
    it('renders header and No active teams when registry empty', () => {
      const api = { on: vi.fn() } as any;
      registerTeamWidget(api);
      const sessionStartCall = api.on.mock.calls.find(([name]) => name === 'session_start');
      const startHandler = sessionStartCall[1] as Function;
      const ctx = createMockExtensionContext();
      startHandler(null, ctx);

      // inspect setWidget call argument lines
      const setWidgetCalls = ctx.ui.setWidget.mock.calls;
      // setWidget called with ("team", lines)
      const lines = setWidgetCalls[0][1] as any[]; // second argument is lines array
      expect(lines.length).toBeGreaterThan(0);
      // Header line: accent styled object, which when converted yields "👥 Team"
      expect(lines[0].toString()).toBe('👥 Team');
      // second line empty
      expect(lines[1].toString()).toBe('');
      // third line: "No active teams"
      expect(lines[2].toString()).toBe('No active teams');
    });
  });
});
