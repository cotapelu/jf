import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiSessionManager } from '../tools/session/manager.js';
import type { AgentSession } from '@earendil-works/pi-coding-agent';

// Duplicate mock helpers from multi-session-manager.test.ts to avoid dependency
function createMockSession(name: string): AgentSession {
  return {
    sessionFile: `/path/to/${name}.jsonl`,
    dispose: vi.fn().mockResolvedValue(undefined),
  } as unknown as AgentSession;
}

function createMockRuntime(initialSession: AgentSession = createMockSession('parent')): any {
  let currentSession: AgentSession | null = initialSession;
  const sessions: AgentSession[] = [initialSession];
  let counter = 0;

  return {
    get session(): AgentSession | null {
      return currentSession;
    },
    set session(s: AgentSession | null) {
      currentSession = s;
    },
    async newSession(options?: { parentSession?: string }): Promise<{ cancelled: boolean }> {
      const newSession = createMockSession(`child-${++counter}`);
      sessions.push(newSession);
      currentSession = newSession;
      return { cancelled: false };
    },
    async switchSession(filePath: string): Promise<void> {
      const target = sessions.find((s) => s.sessionFile === filePath);
      if (!target) {
        throw new Error(`Session not found: ${filePath}`);
      }
      currentSession = target;
    },
    async dispose(): Promise<void> {
      for (const s of sessions) {
        await s.dispose();
      }
      sessions.length = 0;
      currentSession = null;
    },
    _sessions: sessions,
  };
}

describe('MultiSessionManager Coverage Gaps', () => {
  let runtime: any;
  let manager: MultiSessionManager;

  beforeEach(() => {
    const parentSession = createMockSession('parent');
    runtime = createMockRuntime(parentSession);
    manager = new MultiSessionManager(runtime, {
      allowMultipleChildren: true,
      maxSessions: 0,
    });
  });

  describe('createChild()', () => {
    it('should throw when newSession returns cancelled=true', async () => {
      // arrange: make newSession return cancelled true
      runtime.newSession = vi.fn().mockResolvedValue({ cancelled: true });

      await expect(manager.createChild()).rejects.toThrow('Session creation was cancelled');
    });
  });

  describe('switchToChild()', () => {
    it('should switch using numeric index', async () => {
      // Create one child
      const child = await manager.createChild({ name: 'c1' });
      // Ensure root is active
      await manager.switchToParent();
      // Switch to child using numeric index 0
      await manager.switchToChild(0);
      expect(manager.getActive()?.id).toBe(child.id);
    });

    it('should throw when numeric index is out of range', async () => {
      await manager.createChild({ name: 'c1' });
      // Only one child, index 1 out of range
      await expect(manager.switchToChild(1)).rejects.toThrow('Child index out of range: 1');
      // negative index
      await expect(manager.switchToChild(-1)).rejects.toThrow('Child index out of range: -1');
    });
  });

  describe('getDiagnostics()', () => {
    it('should include cleanup stats after recordCleanup', () => {
      // Initially no cleanup stats included
      let diag = manager.getDiagnostics();
      expect(diag.cleanup).toBeUndefined();

      // Record cleanup
      manager.recordCleanup(5);
      diag = manager.getDiagnostics();
      expect(diag.cleanup).toBeDefined();
      expect(diag.cleanup!.operations).toBe(1);
      expect(diag.cleanup!.totalCleaned).toBe(5);
      expect(diag.cleanup!.lastCleanup).toBeDefined();
    });
  });
});
