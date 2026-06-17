import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationList, formatListOutput } from '../tools/session/operations/list.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import type { SessionMetadata } from '../tools/session/registry.js';
import { SessionState } from '../tools/session/registry.js';

describe('operationList', () => {
  let mgr: MultiSessionManager;
  let mockList: ReturnType<typeof vi.fn>;

  function createMeta(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
    return {
      id: 'id',
      name: undefined,
      isActive: false,
      createdAt: new Date(),
      filePath: `/path/id.jsonl`,
      tags: [],
      parentId: null,
      state: SessionState.INACTIVE,
      sessionRef: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockList = vi.fn();
    mgr = {
      list: mockList,
    } as unknown as MultiSessionManager;
  });

  it('returns all sessions by default', () => {
    mockList.mockReturnValue([createMeta({ id: 'a' }), createMeta({ id: 'b' })]);
    const result = operationList(mgr, {});
    expect(result.sessions).toHaveLength(2);
  });

  it('filters by active', () => {
    const sessions = [createMeta({ id: '1', isActive: true }), createMeta({ id: '2', isActive: false })];
    mockList.mockReturnValue(sessions);
    const result = operationList(mgr, { filterState: 'active' });
    expect(result.sessions.every(s => s.isActive === true)).toBe(true);
  });

  it('filters by inactive', () => {
    const sessions = [createMeta({ id: '1', isActive: true }), createMeta({ id: '2', isActive: false })];
    mockList.mockReturnValue(sessions);
    const result = operationList(mgr, { filterState: 'inactive' });
    expect(result.sessions.every(s => s.isActive === false)).toBe(true);
  });

  it('sorts by name', () => {
    mockList.mockReturnValue([createMeta({ id: 'c', name: 'Charlie' }), createMeta({ id: 'a', name: 'Alice' }), createMeta({ id: 'b', name: 'Bob' })]);
    const result = operationList(mgr, { sortBy: 'name' });
    expect(result.sessions.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by id', () => {
    mockList.mockReturnValue([createMeta({ id: 'c' }), createMeta({ id: 'a' }), createMeta({ id: 'b' })]);
    const result = operationList(mgr, { sortBy: 'id' });
    expect(result.sessions.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by created (default, descending)', () => {
    const now = Date.now();
    mockList.mockReturnValue([
      createMeta({ id: 'a', createdAt: new Date(now - 1000) }),
      createMeta({ id: 'b', createdAt: new Date(now - 2000) }),
      createMeta({ id: 'c', createdAt: new Date(now) }),
    ]);
    const result = operationList(mgr, { sortBy: 'created' });
    expect(result.sessions.map(s => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('applies limit', () => {
    mockList.mockReturnValue([createMeta({ id: '1' }), createMeta({ id: '2' }), createMeta({ id: '3' })]);
    const result = operationList(mgr, { limit: 2 });
    expect(result.sessions).toHaveLength(2);
  });
});

describe('formatListOutput', () => {
  let mgr: MultiSessionManager;

  function createMeta(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
    return {
      id: 'id',
      name: undefined,
      isActive: false,
      filePath: `/path/id.jsonl`,
      tags: [],
      createdAt: new Date(),
      parentId: null,
      state: SessionState.INACTIVE,
      sessionRef: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    mgr = {
      getActive: vi.fn(),
    } as unknown as MultiSessionManager;
  });

  it('formats sessions with active marker', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue({ id: 's1' } as any);
    const sessions = [createMeta({ id: 's1', isActive: true, name: 'Active Session' }), createMeta({ id: 's2', isActive: false, name: 'Inactive' })];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('🟢 s1');
    expect(out).toContain('⚪ s2');
  });

  it('shows truncated tags', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const sessions = [createMeta({ id: 's1', tags: ['alpha', 'beta', 'gamma', 'delta'] })];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('[alpha, beta, gamma]');
    expect(out).not.toContain('delta');
  });

  it('handles empty tags gracefully', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const sessions = [createMeta({ id: 's1', tags: [] })];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('s1');
    expect(typeof out).toBe('string');
  });
});
