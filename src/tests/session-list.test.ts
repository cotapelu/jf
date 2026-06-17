import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationList, formatListOutput } from '../tools/session/operations/list.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import type { SessionMetadata } from '../tools/session/registry.js';

describe('operationList', () => {
  let mgr: MultiSessionManager;
  let mockList: ReturnType<typeof vi.fn>;

  function createMeta(id: string, name?: string, isActive = false, createdAt = new Date()): SessionMetadata {
    return {
      id,
      name,
      isActive,
      createdAt,
      filePath: `/path/${id}.jsonl`,
      tags: [],
      parentId: null,
      state: 'created',
      sessionRef: undefined,
    } as SessionMetadata;
  }

  beforeEach(() => {
    mockList = vi.fn();
    mgr = {
      list: mockList,
    } as unknown as MultiSessionManager;
  });

  it('returns all sessions by default', () => {
    mockList.mockReturnValue([createMeta('a'), createMeta('b')]);
    const result = operationList(mgr, {});
    expect(result.sessions).toHaveLength(2);
  });

  it('filters by active', () => {
    const sessions = [createMeta('1', undefined, true), createMeta('2', undefined, false)];
    mockList.mockReturnValue(sessions);
    const result = operationList(mgr, { filterState: 'active' });
    expect(result.sessions.every(s => s.isActive === true)).toBe(true);
  });

  it('filters by inactive', () => {
    const sessions = [createMeta('1', undefined, true), createMeta('2', undefined, false)];
    mockList.mockReturnValue(sessions);
    const result = operationList(mgr, { filterState: 'inactive' });
    expect(result.sessions.every(s => s.isActive === false)).toBe(true);
  });

  it('sorts by name', () => {
    mockList.mockReturnValue([createMeta('c', 'Charlie'), createMeta('a', 'Alice'), createMeta('b', 'Bob')]);
    const result = operationList(mgr, { sortBy: 'name' });
    expect(result.sessions.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by id', () => {
    mockList.mockReturnValue([createMeta('c'), createMeta('a'), createMeta('b')]);
    const result = operationList(mgr, { sortBy: 'id' });
    expect(result.sessions.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by created (default, descending)', () => {
    const now = Date.now();
    mockList.mockReturnValue([
      createMeta('a', undefined, false, new Date(now - 1000)),
      createMeta('b', undefined, false, new Date(now - 2000)),
      createMeta('c', undefined, false, new Date(now)),
    ]);
    const result = operationList(mgr, { sortBy: 'created' });
    expect(result.sessions.map(s => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('applies limit', () => {
    mockList.mockReturnValue([createMeta('1'), createMeta('2'), createMeta('3')]);
    const result = operationList(mgr, { limit: 2 });
    expect(result.sessions).toHaveLength(2);
  });
});

describe('formatListOutput', () => {
  let mgr: MultiSessionManager;

  function createMeta(id: string, name?: string, tags: string[] = [], isActive = false): SessionMetadata {
    return {
      id,
      name,
      isActive,
      filePath: `/path/${id}.jsonl`,
      tags,
      createdAt: new Date(),
      parentId: null,
      state: 'created',
      sessionRef: undefined,
    } as SessionMetadata;
  }

  beforeEach(() => {
    mgr = {
      getActive: vi.fn(),
    } as unknown as MultiSessionManager;
  });

  it('formats sessions with active marker', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue({ id: 's1' });
    const sessions = [createMeta('s1', 'Active Session', [], true), createMeta('s2', 'Inactive', [], false)];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('🟢 s1');
    expect(out).toContain('⚪ s2');
  });

  it('shows truncated tags', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const sessions = [createMeta('s1', undefined, ['alpha', 'beta', 'gamma', 'delta'])];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('[alpha, beta, gamma]');
    expect(out).not.toContain('delta');
  });

  it('handles empty tags gracefully', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const sessions = [createMeta('s1', undefined, [])];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('s1');
    expect(typeof out).toBe('string');
  });
});
