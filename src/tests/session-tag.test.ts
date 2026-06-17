import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationTag } from '../tools/session/operations/tag.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import type { SessionMetadata } from '../tools/session/registry.js';

describe('operationTag', () => {
  let mgr: MultiSessionManager;

  function createMeta(id: string, tags: string[] = []): SessionMetadata {
    return {
      id,
      name: id,
      isActive: false,
      createdAt: new Date(),
      filePath: `/path/${id}.jsonl`,
      tags,
      parentId: null,
      state: 'created',
      sessionRef: undefined,
    } as SessionMetadata;
  }

  beforeEach(() => {
    mgr = {
      addTags: vi.fn(),
      removeTags: vi.fn(),
      getActive: vi.fn(),
    } as unknown as MultiSessionManager;
  });

  it('adds tags successfully', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(createMeta('s1', ['old']));
    (mgr.addTags as ReturnType<typeof vi.fn>).mockReturnValue(createMeta('s1', ['old', 'new']));
    const result = operationTag(mgr, { tags: ['new'], tagAction: 'add' });
    expect(result.details).toMatchObject({ operation: 'tag', action: 'add', sessionId: 's1', tags: ['old', 'new'] });
  });

  it('removes tags successfully', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(createMeta('s1', ['a', 'b']));
    (mgr.removeTags as ReturnType<typeof vi.fn>).mockReturnValue(createMeta('s1', ['a']));
    const result = operationTag(mgr, { tags: ['b'], tagAction: 'remove' });
    expect(result.details.action).toBe('remove');
    expect(result.details.tags).toEqual(['a']);
  });

  it('throws when no sessionId and no active', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(() => operationTag(mgr, { tags: ['x'], tagAction: 'add' })).toThrow('No active session');
  });

  it('throws when tags missing', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(createMeta('s1'));
    expect(() => operationTag(mgr, { tagAction: 'add' })).toThrow('Tags are required');
  });

  it('throws when tagAction missing', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(createMeta('s1'));
    expect(() => operationTag(mgr, { tags: ['x'] })).toThrow('tagAction');
  });

  it('throws when session not found by tag methods', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(createMeta('s1'));
    (mgr.addTags as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(() => operationTag(mgr, { tags: ['x'], tagAction: 'add' })).toThrow('Session not found');
  });
});
