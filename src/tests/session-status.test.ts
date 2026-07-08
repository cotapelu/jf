import { describe, it, expect } from 'vitest';
import { operationStatus } from '../tools/session/operations/status.js';

function createStubManager(overrides?: any): any {
  return {
    getActive: () => null,
    getRoot: () => null,
    getChildren: () => [],
    getDiagnostics: () => ({ totalSessions: 0, disposedCount: 0, historySize: 0 }),
    ...overrides,
  };
}

describe('Session Status', () => {
  it('shows empty status when no sessions', () => {
    const mgr = createStubManager();
    const result = operationStatus(mgr);
    const text = result.content[0].text;
    expect(text).toContain('Active Session: none');
    expect(text).toContain('Root Session: none');
    expect(text).toContain('Total Sessions: 0');
    expect(text).toContain('Children: 0');
    expect(text).toContain('Disposed: 0');
    expect(text).toContain('History Entries: 0');
  });

  it('displays active session name when present', () => {
    const active = { id: 'act-1', name: 'Active Session', filePath: '/path/act' };
    const mgr = createStubManager({
      getActive: () => active,
      getDiagnostics: () => ({ totalSessions: 1, disposedCount: 0, historySize: 5 }),
    });
    const result = operationStatus(mgr);
    const text = result.content[0].text;
    expect(text).toContain('Active Session: act-1 ("Active Session")');
    expect(text).toContain('Root Session: none');
  });

  it('displays root and children correctly', () => {
    const root = { id: 'root-1', name: 'Root', filePath: '/root' };
    const child1 = { id: 'child-1', name: 'Child 1', filePath: '/child1' };
    const child2 = { id: 'child-2', name: 'Child 2', filePath: '/child2' };
    const mgr = createStubManager({
      getActive: () => child1,
      getRoot: () => root,
      getChildren: () => [child1, child2],
      getDiagnostics: () => ({ totalSessions: 3, disposedCount: 1, historySize: 10 }),
    });
    const result = operationStatus(mgr);
    const text = result.content[0].text;
    expect(text).toContain('Active Session: child-1 ("Child 1")');
    expect(text).toContain('Root Session: root-1');
    expect(text).toContain('Children: 2');
    expect(text).toContain('Disposed: 1');
    expect(text).toContain('History Entries: 10');
    expect(result.details.activeSession).toEqual({ id: 'child-1', name: 'Child 1', filePath: '/child1' });
    expect(result.details.rootSession).toEqual({ id: 'root-1', name: 'Root', filePath: '/root' });
    expect(result.details.children).toHaveLength(2);
  });

  it('handles active session without name', () => {
    const active = { id: 'act-2', name: undefined, filePath: '/path' };
    const mgr = createStubManager({
      getActive: () => active,
      getDiagnostics: () => ({ totalSessions: 1, disposedCount: 0, historySize: 0 }),
    });
    const result = operationStatus(mgr);
    const text = result.content[0].text;
    expect(text).toContain('Active Session: act-2');
    // Ensure no quotes appear when name is missing
    expect(text).not.toMatch(/act-2\s*"/);
  });
});
