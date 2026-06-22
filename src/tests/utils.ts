import type { AgentSession, AgentSessionRuntime, AgentSessionServices, AgentSessionRuntimeDiagnostic } from '@earendil-works/pi-coding-agent';

/**
 * Create a minimal mock AgentSession
 */
export function createMockSession(name: string): AgentSession {
  // Minimal shape; cast to any then to AgentSession to satisfy type (tests only)
  return {
    sessionFile: `/path/to/${name}.jsonl`,
    dispose: async () => {},
  } as unknown as AgentSession;
}

/**
 * Create a mock AgentSessionRuntime
 *
 * Supports:
 * - session getter/setter
 * - newSession(options)
 * - switchSession(filePath)
 * - dispose()
 *
 * Also maintains an internal array of sessions for verification.
 */
export function createMockRuntime(initialSession: AgentSession = createMockSession('parent')): AgentSessionRuntime {
  let currentSession: AgentSession | null = initialSession;
  const sessions: AgentSession[] = [initialSession];
  let counter = 0;

  // Use `any` internally to avoid needing to implement all methods of AgentSessionRuntime
  const runtime: any = {
    get session() {
      return currentSession;
    },
    set session(s) {
      currentSession = s;
    },
    async newSession(options?: { parentSession?: string }) {
      const newSession = createMockSession(`child-${++counter}`);
      sessions.push(newSession);
      currentSession = newSession;
      return { cancelled: false };
    },
    async switchSession(filePath: string) {
      const target = sessions.find((s) => s.sessionFile === filePath);
      if (!target) throw new Error(`Session not found: ${filePath}`);
      currentSession = target;
    },
    async dispose() {
      for (const s of sessions) await s.dispose();
      sessions.length = 0;
      currentSession = null;
    },
    _sessions: sessions,
  };

  return runtime as AgentSessionRuntime;
}
