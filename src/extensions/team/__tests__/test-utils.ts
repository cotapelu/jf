/**
 * Test utilities for team tests
 */

import { AgentTeam } from '../team-manager.js';

/**
 * Create a mock runtime for testing
 * Returns a minimal object satisfying AgentSessionRuntime shape
 */
export function createMockRuntime(): any {
  return {
    session: {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: async () => {},
      sessionManager: {},
    },
    cwd: process.cwd(),
    services: {
      authStorage: {},
      settingsManager: {},
      modelRegistry: {},
      diagnostics: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    },
    dispose: async () => {},
  };
}

/**
 * Create a minimal team for testing
 */
export function createTestTeam(teamId?: string): AgentTeam {
  const team = new AgentTeam();
  if (teamId) {
    team.id = teamId;
  }
  return team;
}
