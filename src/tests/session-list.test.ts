import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationList, formatListOutput } from '../tools/session/operations/list.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import type { SessionMetadata } from '../tools/session/registry.js';

describe('operationList', () => {
  let mgr: MultiSessionManager;
  let mockList: vi.Mock;

  function createMeta(id: string, name?: string, isActive = false, createdAt = new Date()) {
    return {
      id,
      name,
      isActive,
      createdAt,
      filePath: `/path/${id}.jsonl`,
      tags: [],
    } as SessionMetadata;
  }

  beforeEach(() => {
    mockList = vi.fn();
    (mgr as any) = { list: mockList };
  });

  it('returns all sessions by default', () => {
    mockList.mockReturnValue([createMeta('a'), createMeta('b')]);
    const result = operationList(mgr as any, {});
    expect(result.sessions).toHaveLength(2);
  });

  it('filters by active', () => {
    const sessions = [createMeta('1', undefined, true), createMeta('2', undefined, false)];
    mockList.mockReturnValue(sessions);
    const result = operationList(mgr as any, { filterState: 'active' });
    expect(result.sessions.every((s: any) => s.isActive === true)).toBe(true);
  });

  it('filters by inactive', () => {
    const sessions = [createMeta('1', undefined, true), createMeta('2', undefined, false)];
    mockList.mockReturnValue(sessions);
    const result = operationList(mgr as any, { filterState: 'inactive' });
    expect(result.sessions.every((s: any) => s.isActive === false)).toBe(true);
  });

  it('sorts by name', () => {
    mockList.mockReturnValue([createMeta('c', 'Charlie'), createMeta('a', 'Alice'), createMeta('b', 'Bob')]);
    const result = operationList(mgr as any, { sortBy: 'name' });
    expect(result.sessions.map((s: any) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by id', () => {
    mockList.mockReturnValue([createMeta('c'), createMeta('a'), createMeta('b')]);
    const result = operationList(mgr as any, { sortBy: 'id' });
    expect(result.sessions.map((s: any) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by created (default, descending)', () => {
    const now = Date.now();
    mockList.mockReturnValue([
      createMeta('a', undefined, false, new Date(now - 1000)),
      createMeta('b', undefined, false, new Date(now - 2000)),
      createMeta('c', undefined, false, new Date(now)),
    ]);
    const result = operationList(mgr as any, { sortBy: 'created' });
    expect(result.sessions.map((s: any) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('applies limit', () => {
    mockList.mockReturnValue([createMeta('1'), createMeta('2'), createMeta('3')]);
    const result = operationList(mgr as any, { limit: 2 });
    expect(result.sessions).toHaveLength(2);
  });
});

describe('formatListOutput', () => {
  let mgr: MultiSessionManager;

  function createMeta(id: string, name?: string, tags: string[] = [], isActive = false) {
    return {
      id,
      name,
      isActive,
      filePath: `/path/${id}.jsonl`,
      tags,
    } as SessionMetadata;
  }

  beforeEach(() => {
    mgr = {
      getActive: vi.fn(),
    } as any;
  });

  it('formats sessions with active marker', () => {
    (mgr.getActive as any).mockReturnValue({ id: 's1' });
    const sessions = [createMeta('s1', 'Active Session', [], true), createMeta('s2', 'Inactive', [], false)];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('🟢 s1');
    expect(out).toContain('⚪ s2');
  });

  it('shows truncated tags', () => {
    (mgr.getActive as any).mockReturnValue(null);
    const sessions = [createMeta('s1', undefined, ['alpha', 'beta', 'gamma', 'delta'])];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('[alpha, beta, gamma]');
    expect(out).not.toContain('delta');
  });

  it('handles empty tags gracefully', () => {
    (mgr.getActive as any).mockReturnValue(null);
    const sessions = [createMeta('s1', undefined, [])];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('s1');
    expect(typeof out).toBe('string');
  });
});
