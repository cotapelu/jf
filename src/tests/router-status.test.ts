import { describe, it, expect, vi } from 'vitest';

describe('Router Status Operation', () => {
  it('should execute status successfully', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: () => ({ id: 'active1', name: 'Active', filePath: '/a' } as any),
        getRoot: () => ({ id: 'root1', name: 'Root', filePath: '/r' } as any),
        getChildren: () => [] as any,
        getDiagnostics: () => ({ totalSessions: 1, activeSessionId: 'active1', rootSessionId: 'root1', childCount: 0, disposedCount: 0, historySize: 0 } as any),
      } as any),
    } as any);

    let result;
    try {
      result = await router.execute('test', { operation: 'status' });
      console.log('Result:', result);
    } catch (e) {
      console.error('Error thrown:', e);
      throw e;
    }
    expect(result).toBeDefined();
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Session Status');
  });
});
