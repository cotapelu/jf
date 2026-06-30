import { describe, it, expect } from 'vitest';
import { operationStatus } from '../tools/session/operations/status.js';
import { operationHistory } from '../tools/session/operations/history.js';
import { operationTree } from '../tools/session/operations/tree.js';
import type { MultiSessionManager, SessionMetadata } from '../tools/session/manager.js';
import { SessionState } from '../tools/session/registry.js';

function mockSession(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    id: '',
    filePath: '',
    parentId: null,
    createdAt: new Date(),
    name: undefined,
    tags: [],
    state: SessionState.ACTIVE,
    sessionRef: null,
    isActive: false,
    ...overrides,
  } as unknown as SessionMetadata;
}

function createEmptyManager(): MultiSessionManager {
  const base = {
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
  };
  return base as unknown as MultiSessionManager;
}

describe('Session operations - empty state', () => {
  it('operationStatus with no sessions', () => {
    const mgr = createEmptyManager();
    const result = operationStatus(mgr);
    expect(result.content[0].text).toContain('Active Session: none');
    expect(result.content[0].text).toContain('Root Session: none');
    expect(result.content[0].text).toContain('Total Sessions: 0');
    expect(result.details.activeSession).toBeNull();
    expect(result.details.rootSession).toBeNull();
    expect(result.details.children).toEqual([]);
  });

  it('operationStatus with active session having name', () => {
    const mgr = createEmptyManager();
    mgr.getActive = () => mockSession({ id: 'act', name: 'Active Session', isActive: true });
    mgr.getRoot = () => null;
    mgr.getChildren = () => [];
    mgr.getDiagnostics = () => ({
      totalSessions: 1,
      activeSessionId: 'act',
      rootSessionId: null,
      childCount: 0,
      disposedCount: 0,
      historySize: 0,
    });
    const result = operationStatus(mgr);
    expect(result.content[0].text).toContain('Active Session: act');
    expect(result.content[0].text).toContain('("Active Session")');
  });

  it('operationStatus with active session having empty name', () => {
    const mgr = createEmptyManager();
    mgr.getActive = () => mockSession({ id: 'act2', name: '', isActive: true });
    mgr.getRoot = () => null;
    mgr.getChildren = () => [];
    mgr.getDiagnostics = () => ({
      totalSessions: 1,
      activeSessionId: 'act2',
      rootSessionId: null,
      childCount: 0,
      disposedCount: 0,
      historySize: 0,
    });
    const result = operationStatus(mgr);
    expect(result.content[0].text).toContain('Active Session: act2');
    // Should NOT have quotes around empty name
    expect(result.content[0].text).not.toContain('""');
  });

  it('operationHistory with empty history (default limit)', () => {
    const mgr = createEmptyManager();
    const result = operationHistory(mgr, {});
    expect(result.content[0].text).toContain('Operation History (last 0 entries)');
    expect(result.details.count).toBe(0);
    expect(result.details.entries).toEqual([]);
  });

  it('operationHistory with explicit limit', () => {
    const mgr = createEmptyManager();
    const result = operationHistory(mgr, { limit: 5 });
    expect(result.details.entries).toEqual([]);
  });

  it('operationTree with empty tree', () => {
    const mgr = createEmptyManager();
    const result = operationTree(mgr);
    expect(result.content[0].text).toContain('Session Tree:');
    expect(result.details.rootId).toBeUndefined();
    expect(result.details.totalNodes).toBe(0);
  });
});
