// @ts-nocheck
import { vi, expect } from 'vitest';
import { AgentTeam } from '../team-manager.js';
import { SessionManager, SettingsManager, AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import type { AgentSessionRuntime, AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let counter = 0;

// Helper to access private fields of AgentTeam for testing
interface AgentTeamInternal {
  [key: string]: any;
}
function getInternal(team: AgentTeam): AgentTeamInternal {
  return team as unknown as AgentTeamInternal;
}

// Simple mock runtime factory - returns plain objects, no recursion
function createSimpleRuntime(role: string): Partial<AgentSessionRuntime> {
  const id = `session-${role}-${counter++}`;
  const tmpAgentDir = path.join(os.tmpdir(), `evo-test-${role}-${Date.now()}`);
  try { fs.mkdirSync(tmpAgentDir, { recursive: true }); } catch (e) {}

  // Use real in-memory services to avoid mocking hundreds of methods
  const settingsManager = SettingsManager.inMemory({});
  const authStorage = AuthStorage.inMemory();
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const sessionMgr = SessionManager.create(process.cwd(), tmpAgentDir);

  return {
    session: {
      sessionId: id,
      subscribe: vi.fn().mockReturnValue(() => {}),
      sessionManager: sessionMgr,
    },
    services: {
      agentDir: tmpAgentDir,
      cwd: process.cwd(),
      diagnostics: [],
      authStorage,
      settingsManager,
      modelRegistry,
    },
    cwd: process.cwd(),
    setRebindSession: vi.fn(),
    setBeforeSessionInvalidate: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
    createRuntime: vi.fn(),
  };
}

function createMockAgentSessionEvent(type: string, message?: any): AgentSessionEvent {
  return {
    type,
    ...(message && { message })
  } as AgentSessionEvent;
}

describe('AgentTeam Multi-Runtime', () => {
  let team: AgentTeam;
  let parentRuntime: AgentSessionRuntime;
  let notifyUpdateSpy: any;

  function setRoles(team: AgentTeam, count: number) {
    const roles = Array.from({ length: count }, (_, i) => `agent-${i + 1}`);
    team.roles = roles;
    for (const role of roles) {
      team.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
    }
    team.size = roles.length;
  }

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
    parentRuntime = createSimpleRuntime('parent') as AgentSessionRuntime;
    // Configure parent's createRuntime to return a fresh child runtime each call
    parentRuntime.createRuntime = vi.fn().mockImplementation(async (factory: any, options: any) => {
      return createSimpleRuntime('child') as AgentSessionRuntime;
    });
    // Verify mock is set
    expect(typeof parentRuntime.createRuntime).toBe('function');
    notifyUpdateSpy = vi.spyOn(team, 'notifyUpdate');
  });

  afterEach(async () => {
    await team.dispose();
    if (notifyUpdateSpy && notifyUpdateSpy.mockRestore) {
      notifyUpdateSpy.mockRestore();
    }
  });

  describe('setupChildRuntimes', () => {
    it('should create correct number of child runtimes (teamSize=4)', async () => {
      setRoles(team, 4);
      await team.initialize(['task1', 'task2']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });
      const runtimes = getInternal(team).runtimes;
      console.log('runtimes session objects:', runtimes.map((r: any) => r.session));
      // Check that the mock was used
      expect(parentRuntime.createRuntime).toHaveBeenCalledTimes(4);

      // runtimes array should contain all 4 child runtimes
      console.log('runtimes length:', getInternal(team).runtimes.length);
      expect(getInternal(team).runtimes.length).toBe(4);
      // All roles are present
      expect(team.roles).toEqual(['agent-1', 'agent-2', 'agent-3', 'agent-4']);
      // Each runtime should map to a role
      for (const role of team.roles) {
        console.log('checking role', role);
        const allRuntimes = getInternal(team).runtimes;
        console.log('total runtimes:', allRuntimes.length);
        // sessionId is stored in session.sessionManager.sessionId
        const sessionIds = allRuntimes.map((r: any) => {
          const s = r.session;
          // Prefer direct sessionId, fallback to sessionManager.sessionId
          return s?.sessionId ?? s?.sessionManager?.sessionId ?? 'MISSING';
        });
        console.log('all runtimes sessionIds:', JSON.stringify(sessionIds));
        const runtime = allRuntimes.find((r: any) => {
          const s = r.session;
          const sid = s?.sessionId ?? s?.sessionManager?.sessionId ?? 'MISSING';
          const mappedRole = getInternal(team).roleByAgentId.get(sid);
          console.log('checking role', role, 'sid:', sid, 'mappedRole:', mappedRole);
          return mappedRole === role;
        });
        console.log('found runtime?', !!runtime, 'roleByAgentId map:', Array.from(getInternal(team).roleByAgentId.entries()));
        expect(runtime).toBeDefined();
      }
    });

    it('should create child runtimes with custom agentCwd', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, '/custom/agent/cwd', { createRuntime: parentRuntime.createRuntime });

      const createCalls = (parentRuntime.createRuntime as vi.Mock).mock.calls;
      expect(createCalls.length).toBe(2);
      // The second argument of the call is the options object
      const [, firstOpts] = createCalls[0];
      expect(firstOpts.cwd).toBe('/custom/agent/cwd');
    });

    it('should use parent cwd when agentCwd not provided', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });

      const createCalls = (parentRuntime.createRuntime as vi.Mock).mock.calls;
      expect(createCalls.length).toBe(2);
      const [, firstOpts] = createCalls[0];
      expect(firstOpts.cwd).toBe(parentRuntime.cwd);
    });

    it('should create isolated session directories for each agent', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });

      const createCalls = (parentRuntime.createRuntime as vi.Mock).mock.calls;
      // agentDir should be unique per agent: teams/<team-id>/<role>
      const [, firstOpts] = createCalls[0];
      const [, secondOpts] = createCalls[1];
      const firstAgentDir = firstOpts.agentDir as string;
      const secondAgentDir = secondOpts.agentDir as string;
      expect(firstAgentDir).toContain(`teams${path.sep}test-team${path.sep}agent-1`);
      expect(secondAgentDir).toContain(`teams${path.sep}test-team${path.sep}agent-2`);
      expect(firstAgentDir).not.toBe(secondAgentDir);
    });

    it('should subscribe to child session events', async () => {
      setRoles(team, 1);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });

      const childRuntime = getInternal(team).runtimes[0];
      const subscribe = childRuntime.session.subscribe as vi.Mock;
      expect(subscribe).toHaveBeenCalled();
      const handler = subscribe.mock.calls[0][0];
      expect(typeof handler).toBe('function');
    });

    it('should map role to runtime session.id', async () => {
      setRoles(team, 3);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });

      // Every runtime.session.sessionId should map to a role
      const internal = getInternal(team);
      for (const rt of internal.runtimes) {
        const role = internal.roleByAgentId.get(rt.session.sessionId);
        expect(role).toBeDefined();
        expect(team.roles).toContain(role);
      }
    });
  });

  describe('handleAgentEvent', () => {
    let childRuntime: AgentSessionRuntime;

    beforeEach(async () => {
      setRoles(team, 1);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });
      // Clear notification history after initialization
      notifyUpdateSpy.mockClear();
      childRuntime = getInternal(team).runtimes[0];
    });

    it('should forward agent_start event with role prefix', async () => {
      const internal = getInternal(team);
      internal.handleAgentEvent('agent-1', { type: 'agent_start' });

      expect(notifyUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [expect.objectContaining({ text: expect.stringContaining('[agent-1]') })],
          details: expect.objectContaining({ role: 'agent-1', eventType: 'agent_start' })
        })
      );
    });

    it('should forward agent_end event with error flag', async () => {
      const internal = getInternal(team);
      internal.handleAgentEvent('agent-1', { type: 'agent_end', stopReason: 'error' });

      expect(notifyUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [expect.objectContaining({ text: expect.stringContaining('[agent-1]') })],
          isError: true
        })
      );
    });

    it('should forward message_start with correct content truncation', async () => {
      const internal = getInternal(team);
      const longText = 'a'.repeat(300);
      internal.handleAgentEvent('agent-1', {
        type: 'message_start',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: longText }]
        }
      });

      expect(notifyUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [expect.objectContaining({ text: expect.stringMatching(/\[agent-1\] Assistant: .{200}/) })],
          details: expect.objectContaining({ role: 'agent-1', eventType: 'message_start' })
        })
      );
    });

    it('should ignore message_update events (streaming)', async () => {
      const subscribe = childRuntime.session.subscribe as vi.Mock;
      const handler = subscribe.mock.calls[0][0];
      await handler({ type: 'message_update' });

      // Should not call notifyUpdate for streaming updates
      expect(notifyUpdateSpy).not.toHaveBeenCalled();
    });

    it('should handle unknown event types gracefully', async () => {
      const subscribe = childRuntime.session.subscribe as vi.Mock;
      const handler = subscribe.mock.calls[0][0];
      await handler({ type: 'unknown_event' });

      expect(notifyUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('agent loop integration', () => {
    it('should create runtimes (loops started separately)', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });

      // runtimes should be created
      expect(getInternal(team).runtimes.length).toBe(2);
    });

    it('should dispose child runtimes on team.dispose', async () => {
      setRoles(team, 1);
      await team.initialize(['task1']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });

      // Capture runtime before dispose
      const childRuntimes = getInternal(team).runtimes;
      expect(childRuntimes.length).toBeGreaterThan(0);
      const childRuntime = childRuntimes[0];

      await team.dispose();

      // Verify child runtime dispose called
      expect(childRuntime.dispose).toHaveBeenCalled();
    });
  });

  describe('concurrent event forwarding', () => {
    it('should handle multiple events from different agents concurrently', async () => {
      setRoles(team, 2);
      await team.initialize(['task1', 'task2']);
      await team.setupChildRuntimes(parentRuntime, undefined, { createRuntime: parentRuntime.createRuntime });
      // Clear any notifications from initialization
      notifyUpdateSpy.mockClear();

      const [rt1, rt2] = getInternal(team).runtimes;
      const handler1 = rt1.session.subscribe.mock.calls[0][0];
      const handler2 = rt2.session.subscribe.mock.calls[0][0];

      // Forward events concurrently
      await Promise.all([
        handler1({ type: 'agent_start' }),
        handler2({ type: 'agent_start' })
      ]);

      // Both should have been called with correct roles
      expect(notifyUpdateSpy).toHaveBeenCalledTimes(2);
      const calls = notifyUpdateSpy.mock.calls;
      const roles = calls.map((call: any) => call[0].details.role);
      expect(roles).toContain('agent-1');
      expect(roles).toContain('agent-2');
    });
  });
});
