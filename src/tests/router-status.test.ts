import { describe, it, expect, vi } from 'vitest';
import type { MultiSessionManager, SessionMetadata } from '../tools/session/manager.js';

function mockSession(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    id: '',
    filePath: '',
    parentId: null,
    createdAt: new Date(),
    name: undefined,
    tags: [],
    state: 'active' as any,
    sessionRef: null,
    isActive: false,
    ...overrides,
  } as unknown as SessionMetadata;
}

describe('Router Status Operation', () => {
  it('should execute status successfully', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const init = (): MultiSessionManager => ({
      getActive: () => mockSession({ id: 'active1', name: 'Active', isActive: true }),
      getRoot: () => mockSession({ id: 'root1', name: 'Root' }),
      getChildren: () => [],
      getDiagnostics: () => ({
        totalSessions: 1,
        activeSessionId: 'active1',
        rootSessionId: 'root1',
        childCount: 0,
        disposedCount: 0,
        historySize: 0,
      }),
      getHistory: () => [],
      getTree: () => ({ roots: [] }),
    } as unknown as MultiSessionManager);

    const router = createSessionToolRouter({ initialize: init });

    const result = await router.execute('test', { operation: 'status' });
    expect(result).toBeDefined();
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Session Status');
  });
});
