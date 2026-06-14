import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationInfo } from '../tools/session/operations/info.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import type { SessionMetadata } from '../tools/session/registry.js';

describe('operationInfo', () => {
  let mgr: MultiSessionManager;

  function createMeta(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
    return {
      id: 'sess1',
      name: 'Test',
      isActive: false,
      createdAt: new Date(),
      filePath: '/data/s1.jsonl',
      tags: [],
      parentId: null,
      state: 'created',
      sessionRef: undefined,
      ...overrides,
    } as any;
  }

  beforeEach(() => {
    mgr = {
      getActive: vi.fn(),
      get: vi.fn(),
      getRegistry: vi.fn(() => ({
        getChildren: vi.fn(() => []),
      })),
    } as any;
  });

  it('returns info for explicit sessionId', () => {
    const meta = createMeta({ name: 'My Session', tags: ['a', 'b'] });
    (mgr.get as any).mockReturnValue(meta);
    (mgr.getRegistry as any).mockReturnValue({ getChildren: () => [] });

    const result = operationInfo(mgr as any, { sessionId: 'sess1' });

    expect(result.details.operation).toBe('info');
    expect(result.details.session.id).toBe('sess1');
    expect(result.details.session.name).toBe('My Session');
    expect(result.details.session.childCount).toBe(0);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('uses active session when sessionId omitted', () => {
    const meta = createMeta({ name: 'Active' });
    (mgr.getActive as any).mockReturnValue({ id: 'sess1' });
    (mgr.get as any).mockReturnValue(meta);
    (mgr.getRegistry as any).mockReturnValue({ getChildren: () => [] });

    const result = operationInfo(mgr as any, {});

    expect(result.details.session.id).toBe('sess1');
  });

  it('throws when no active session and no sessionId', () => {
    (mgr.getActive as any).mockReturnValue(null);
    expect(() => operationInfo(mgr as any, {})).toThrow('No active session');
  });

  it('throws when session not found', () => {
    (mgr.getActive as any).mockReturnValue(null);
    (mgr.get as any).mockReturnValue(undefined);
    expect(() => operationInfo(mgr as any, { sessionId: 'missing' })).toThrow('Session not found');
  });

  it('includes child count in details', () => {
    const meta = createMeta();
    (mgr.get as any).mockReturnValue(meta);
    (mgr.getRegistry as any).mockReturnValue({
      getChildren: () => [{ id: 'c1' }, { id: 'c2' }],
    });
    const result = operationInfo(mgr as any, { sessionId: 'sess1' });
    expect(result.details.session.childCount).toBe(2);
  });
});
