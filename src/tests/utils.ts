import type { AgentSession } from '@earendil-works/pi-coding-agent';

/**
 * Create a minimal mock AgentSession
 */
export function createMockSession(name: string): AgentSession {
    return {
        sessionFile: `/path/to/${name}.jsonl`,
        dispose: async () => {},
    } as any;
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
export function createMockRuntime(initialSession: AgentSession = createMockSession('parent')): any {
    let currentSession = initialSession;
    const sessions: AgentSession[] = [initialSession];
    let counter = 0;

    return {
        get session(): AgentSession {
            return currentSession;
        },
        set session(s: AgentSession) {
            currentSession = s;
        },
        async newSession(options?: { parentSession?: string }): Promise<{ cancelled: boolean }> {
            const newSession = createMockSession(`child-${++counter}`);
            sessions.push(newSession);
            currentSession = newSession;
            return { cancelled: false };
        },
        async switchSession(filePath: string): Promise<void> {
            const target = sessions.find(s => s.sessionFile === filePath);
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
        // Expose for test verification
        _sessions: sessions,
    };
}
