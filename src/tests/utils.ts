import type { AgentSession, AgentSessionRuntime } from '@earendil-works/pi-coding-agent';

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

class MockRuntime {
  private currentSession: any = null;
  private sessions: any[] = [];
  private counter = 0;

  constructor(initialSession: any) {
    this.currentSession = initialSession;
    this.sessions = [initialSession];
  }

  get session() { return this.currentSession; }
  set session(s: any) { this.currentSession = s; }

  async newSession(_options?: any) {
    const newSession = createMockSession(`child-${++this.counter}`);
    this.sessions.push(newSession);
    this.currentSession = newSession;
    return { cancelled: false };
  }

  async switchSession(filePath: string) {
    const target = this.sessions.find((s: any) => s.sessionFile === filePath);
    if (!target) throw new Error(`Session not found: ${filePath}`);
    this.currentSession = target;
  }

  async dispose() {
    for (const s of this.sessions) await s.dispose();
    this.sessions.length = 0;
    this.currentSession = null;
  }

  get _sessions() { return this.sessions; }
}

export function createMockRuntime(initialSession: any = createMockSession('parent')): any {
  return new MockRuntime(initialSession);
}
