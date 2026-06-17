import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationRename } from '../tools/session/operations/rename.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import type { SessionMetadata } from '../tools/session/registry.js';
import { SessionState } from '../tools/session/registry.js';

describe('operationRename', () => {
  let mgr: MultiSessionManager;

  function createMeta(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
    return {
      id: 'sess1',
      name: 'OldName',
      isActive: false,
      createdAt: new Date(),
      filePath: '/data/s1.jsonl',
      tags: [],
      parentId: null,
      state: SessionState.INACTIVE,
      sessionRef: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    mgr = {
      getActive: vi.fn(),
      rename: vi.fn(),
    } as unknown as MultiSessionManager;
  });

  it('renames session successfully', () => {
    const meta = createMeta({ name: 'New Name' });
    (mgr.rename as ReturnType<typeof vi.fn>).mockReturnValue(meta);
    const result: any = operationRename(mgr, { sessionId: 'sess1', name: 'New Name' });
    expect(result.details).toMatchObject({
      operation: 'rename',
      sessionId: 'sess1',
      newName: 'New Name',
    });
    expect(result.content[0].text).toContain('Renamed session sess1 to "New Name"');
  });

  it('uses active session when sessionId omitted', () => {
    const activeId = 'active1';
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue({ id: activeId } as any);
    (mgr.rename as ReturnType<typeof vi.fn>).mockReturnValue(createMeta({ id: activeId, name: 'Renamed' }));
    const result: any = operationRename(mgr, { name: 'Renamed' });
    expect(result.details.sessionId).toBe(activeId);
  });

  it('throws when no sessionId and no active', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(() => operationRename(mgr, { name: 'X' })).toThrow('No active session');
  });

  it('throws when name is missing', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(createMeta({ id: 's1' } as any));
    expect(() => operationRename(mgr, { sessionId: 's1' })).toThrow('Name is required');
  });

  it('throws when rename returns undefined (session not found)', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (mgr.rename as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(() => operationRename(mgr, { sessionId: 'missing', name: 'X' })).toThrow('Session not found');
  });
});
