import { describe, it, expect } from 'vitest';
import { operationStatus } from '../tools/session/operations/status.js';
import { operationHistory } from '../tools/session/operations/history.js';
import { operationTree } from '../tools/session/operations/tree.js';
import type { MultiSessionManager } from '../tools/session/manager.js';

function createEmptyManager(): Partial<MultiSessionManager> {
  return {
    getActive: () => null,
    getRoot: () => null,
    getChildren: () => [],
    getDiagnostics: () => ({
      totalSessions: 0,
      activeSessionId: null,
      rootSessionId: null,
      childCount: 0,
      disposedCount: 0,
      historySize: 0,
    }),
    getHistory: () => [],
    getTree: () => ({ roots: [] }),
  } as any;
}

describe('Session operations - empty state', () => {
  it('operationStatus with no sessions', () => {
    const mgr = createEmptyManager() as unknown as MultiSessionManager;
    const result = operationStatus(mgr);
    expect(result.content[0].text).toContain('Active Session: none');
    expect(result.content[0].text).toContain('Root Session: none');
    expect(result.content[0].text).toContain('Total Sessions: 0');
    expect(result.details.activeSession).toBeNull();
    expect(result.details.rootSession).toBeNull();
    expect(result.details.children).toEqual([]);
  });

  it('operationHistory with empty history (default limit)', () => {
    const mgr = createEmptyManager() as unknown as MultiSessionManager;
    const result = operationHistory(mgr, {});
    expect(result.content[0].text).toContain('Operation History (last 0 entries)');
    expect(result.details.count).toBe(0);
    expect(result.details.entries).toEqual([]);
  });

  it('operationHistory with explicit limit', () => {
    const mgr = createEmptyManager() as unknown as MultiSessionManager;
    const result = operationHistory(mgr, { limit: 5 });
    expect(result.details.entries).toEqual([]);
  });

  it('operationTree with empty tree', () => {
    const mgr = createEmptyManager() as unknown as MultiSessionManager;
    const result = operationTree(mgr);
    expect(result.content[0].text).toContain('Session Tree:');
    expect(result.details.rootId).toBeUndefined();
    expect(result.details.totalNodes).toBe(0);
  });
});
