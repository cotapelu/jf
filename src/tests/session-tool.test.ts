import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setCurrentRuntime, clearCurrentRuntime } from '../runtime-context.js';
import { resetSessionTool, createSessionTool } from '../tools/session/index.js';
import { createMockRuntime, createMockSession } from './utils.js';

// Helper type for tool execution results (matches the actual return shape)
type ToolResult = {
  content: Array<{ type: string; text: string }>;
  details?: any;
  isError?: boolean;
};

function asToolResult(result: any): ToolResult {
  return result as ToolResult;
}

describe('SessionTool', () => {
  let runtime: any;
  let tool: any;

  beforeEach(() => {
    // Reset tool singleton and runtime context
    resetSessionTool();
    clearCurrentRuntime();

    const parentSession = createMockSession('parent');
    runtime = createMockRuntime(parentSession);
    setCurrentRuntime(runtime);

    // Create the tool (initializes manager)
    tool = createSessionTool();
  });

  // Helper functions for common session operations
  async function createSession(label: string, name: string): Promise<any> {
    return await tool.execute(label, { operation: 'create', name });
  }

  async function switchSession(label: string, sessionId: string): Promise<any> {
    return await tool.execute(label, { operation: 'switch', sessionId });
  }

  async function listSessions(label: string, filterState?: string): Promise<any> {
    const params: any = { operation: 'list' };
    if (filterState) params.filterState = filterState;
    return await tool.execute(label, params);
  }

  async function getStatus(label: string): Promise<any> {
    return await tool.execute(label, { operation: 'status' });
  }

  function assertNoError(result: any): void {
    // @ts-ignore
    expect(result.isError).toBeUndefined();
    // @ts-ignore
    expect(result.details).toBeDefined();
    // @ts-ignore
    expect(result.details.sessionId).toBeDefined();
  }

  function assertSessionIdsUnique(ids: string[], expectedCount: number): void {
    expect(new Set(ids).size).toBe(expectedCount);
  }

  function assertTotalSessions(status: any, expected: number): void {
    // @ts-ignore
    expect(status.details.diagnostics.totalSessions).toBe(expected);
  }

  function assertActiveCount(list: any, expected: number): void {
    // @ts-ignore
    const active = list.details.sessions.filter((s: any) => s.isActive).length;
    expect(active).toBe(expected);
  }

  function assertListContains(list: any, text: string): void {
    // @ts-ignore
    expect(list.content[0].text).toContain(text);
  }

  function assertListNotContains(list: any, text: string): void {
    // @ts-ignore
    expect(list.content[0].text).not.toContain(text);
  }

  async function createConcurrent(baseLabel: string, names: string[]): Promise<any[]> {
    return Promise.all(names.map((name, i) => createSession(`${baseLabel}${i+1}`, name)));
  }

  describe('Tool Definition', () => {
    it('should have correct metadata', () => {
      expect(tool.name).toBe('session');
      expect(tool.label).toBe('Session Management');
      expect(tool.description).toContain('Comprehensive session management');
      expect(tool.promptSnippet).toContain('manage sessions');
    });

    it('should define all operations in parameters', () => {
      const ops = tool.parameters.properties.operation.enum;
      expect(ops).toContain('create');
      expect(ops).toContain('switch');
      expect(ops).toContain('list');
      expect(ops).toContain('info');
      expect(ops).toContain('rename');
      expect(ops).toContain('tag');
      expect(ops).toContain('delete');
      expect(ops).toContain('export');
      expect(ops).toContain('tree');
      expect(ops).toContain('history');
      expect(ops).toContain('status');
      expect(ops).toContain('diagnostics');
    });
  });

  describe('create operation', () => {
    it('should create a new child session', async () => {
      const result: any = await tool.execute('create1', { operation: 'create', name: 'my-child' });

      // @ts-ignore
      expect(result.isError).toBeFalsy();
      // @ts-ignore
      expect(result.content[0].text).toContain('Created new child session');
      // @ts-ignore
      expect(result.details.sessionId).toBeDefined();
      // @ts-ignore
      expect(result.details.name).toBe('my-child');
      // @ts-ignore
      expect(result.details.tags).toContain('child');
    });

    it('should auto-generate name if not provided', async () => {
      const result: any = await tool.execute('create2', { operation: 'create' });
      // @ts-ignore
      expect(result.details.name).toMatch(/^child-\d+$/);
    });

    it('should add custom tags', async () => {
      const result: any = await tool.execute('create3', {
        operation: 'create',
        tags: ['debug', 'test'],
      });
      // @ts-ignore
      expect(result.details.tags).toContain('debug');
      // @ts-ignore
      expect(result.details.tags).toContain('test');
      // @ts-ignore
      expect(result.details.tags).toContain('child');
    });

    it('should set parent to current active session', async () => {
      const result1 = await tool.execute('create4a', { operation: 'create', name: 'child-1' });
      // @ts-ignore
      const child1Id = result1.details.sessionId;

      // Child-1 is now active. Create another without specifying parent.
      const result2 = await tool.execute('create4b', { operation: 'create', name: 'child-2' });
      // @ts-ignore
      const child2Id = result2.details.sessionId;

      // Verify via info: child-2 parent should be child-1
      const infoResult: any = await tool.execute('info_child2', {
        operation: 'info',
        sessionId: child2Id,
      });
      // @ts-ignore
      expect(infoResult.details.session.parentId).toBe(child1Id);
    });
  });

  describe('switch operation', () => {
    it('should switch to a specific session by ID', async () => {
      const createResult: any = await tool.execute('switch_create', {
        operation: 'create',
        name: 'child',
      });
      // @ts-ignore
      const childId = createResult.details.sessionId;

      // Switch to parent first
      await tool.execute('switch_parent1', { operation: 'switch', sessionId: 'parent' });
      let status = await tool.execute('status_before', { operation: 'status' });
      // @ts-ignore
      expect(status.content[0].text).toContain('parent');

      // Switch to child
      await tool.execute('switch_child1', { operation: 'switch', sessionId: childId });
      status = await tool.execute('status_after', { operation: 'status' });
      // @ts-ignore
      expect(status.content[0].text).toContain(childId);
    });

    it('should switch to parent using alias', async () => {
      const createResult: any = await tool.execute('switch_parent_', { operation: 'create' });
      await tool.execute('switch_parent_alias', { operation: 'switch', sessionId: 'parent' });

      const status: any = await tool.execute('status_parent', { operation: 'status' });
      // @ts-ignore
      expect(status.content[0].text).toContain('parent');
    });

    it('should throw when switching to non-existent session', async () => {
      const result: any = await tool.execute('switch_fail', {
        operation: 'switch',
        sessionId: 'nonexistent',
      });
      // @ts-ignore
      expect(result.isError).toBe(true);
      // @ts-ignore
      expect(result.content[0].text).toContain('Error: Session not found');
    });

    it('should throw when already active', async () => {
      const createResult: any = await tool.execute('switch_already', { operation: 'create' });
      // @ts-ignore
      const childId = createResult.details.sessionId;
      const result: any = await tool.execute('switch_already2', {
        operation: 'switch',
        sessionId: childId,
      });
      // @ts-ignore
      expect(result.isError).toBe(true);
      // @ts-ignore
      expect(result.content[0].text).toContain('Already active');
    });

    it('should throw when sessionId is not provided', async () => {
      const result: any = await tool.execute('switch_missing', { operation: 'switch' });
      // @ts-ignore
      expect(result.isError).toBe(true);
      // @ts-ignore
      expect(result.content[0].text).toContain('Target session not specified or not found');
    });
  });

  describe('list operation', () => {
    it('should list all sessions by default', async () => {
      await tool.execute('list1', { operation: 'create', name: 'child-1' });
      await tool.execute('list2', { operation: 'create', name: 'child-2' });
      await tool.execute('switch', { operation: 'switch', sessionId: 'parent' });

      const result: any = await tool.execute('list3', { operation: 'list' });
      // @ts-ignore
      expect(result.content[0].text).toContain('child-1');
      // @ts-ignore
      expect(result.content[0].text).toContain('child-2');
      // @ts-ignore
      expect(result.content[0].text).toContain('parent');
    });

    it('should filter by state', async () => {
      await tool.execute('list_f1', { operation: 'create', name: 'active-child' });
      // Switch to parent; the child becomes inactive but not disposed
      await tool.execute('list_f2', { operation: 'switch', sessionId: 'parent' });

      const resultActive = await tool.execute('list_f3', {
        operation: 'list',
        filterState: 'active',
      });
      // Only parent is active now
      // @ts-ignore
      expect(resultActive.content[0].text).toContain('parent');
      // @ts-ignore
      expect(resultActive.content[0].text).not.toContain('active-child');

      const resultInactive = await tool.execute('list_f4', {
        operation: 'list',
        filterState: 'inactive',
      });
      // @ts-ignore
      expect(resultInactive.content[0].text).toContain('active-child');
    });

    it('should limit results', async () => {
      for (let i = 0; i < 5; i++) {
        await tool.execute(`list_l${i}`, { operation: 'create', name: `child-${i}` });
      }
      await tool.execute('list_lparent', { operation: 'switch', sessionId: 'parent' });

      const result: any = await tool.execute('list_limited', { operation: 'list', limit: 3 });
      // Should have exactly 3 sessions in output
      // @ts-ignore
      const sessions = result.details.sessions;
      expect(sessions).toHaveLength(3);
    });

    it('should sort by name', async () => {
      await tool.execute('sort1', { operation: 'create', name: 'z-child' });
      await tool.execute('sort2', { operation: 'create', name: 'a-child' });
      await tool.execute('switch', { operation: 'switch', sessionId: 'parent' });

      const result: any = await tool.execute('sort3', { operation: 'list', sortBy: 'name' });
      // @ts-ignore
      const lines = result.content[0].text.split('\n');
      // Find lines that contain children (excluding the first "Sessions (...)" line)
      const childLines = lines.filter((l: any) => l.includes('child-'));
      expect(childLines[0]).toContain('a-child');
      expect(childLines[1]).toContain('z-child');
    });
  });

  describe('info operation', () => {
    it('should show detailed info for a session', async () => {
      const createResult: any = await tool.execute('info1', {
        operation: 'create',
        name: 'info-child',
        tags: ['tag1', 'tag2'],
      });
      // @ts-ignore
      const childId = createResult.details.sessionId;

      const result: any = await tool.execute('info2', { operation: 'info', sessionId: childId });

      // @ts-ignore
      expect(result.content[0].text).toContain('ID: ' + childId);
      // @ts-ignore
      expect(result.content[0].text).toContain('info-child');
      // @ts-ignore
      expect(result.content[0].text).toContain('tag1, tag2');
      // @ts-ignore
      expect(result.content[0].text).toContain('child');
    });

    it('should default to active session if no sessionId provided', async () => {
      const result: any = await tool.execute('info_active', { operation: 'info' });
      // Should show info about parent initially
      // @ts-ignore
      expect(result.content[0].text).toContain('parent');
    });
  });

  describe('rename operation', () => {
    it('should rename a session', async () => {
      const createResult: any = await tool.execute('rename1', {
        operation: 'create',
        name: 'old-name',
      });
      // @ts-ignore
      const sessionId = createResult.details.sessionId;

      const result: any = await tool.execute('rename2', {
        operation: 'rename',
        sessionId,
        name: 'new-name',
      });

      // @ts-ignore
      expect(result.content[0].text).toContain('Renamed session');
      // @ts-ignore
      expect(result.details.newName).toBe('new-name');
    });

    it('should require name parameter', async () => {
      const createResult: any = await tool.execute('rename_err1', { operation: 'create' });
      // @ts-ignore
      const sessionId = createResult.details.sessionId;

      const result: any = await tool.execute('rename_err2', {
        operation: 'rename',
        sessionId,
      });
      // @ts-ignore
      expect(result.isError).toBe(true);
      // @ts-ignore
      expect(result.content[0].text).toContain('Name is required');
    });
  });

  describe('tag operation', () => {
    it('should add tags', async () => {
      const createResult: any = await tool.execute('tag_add1', { operation: 'create' });
      // @ts-ignore
      const sessionId = createResult.details.sessionId;

      const result: any = await tool.execute('tag_add2', {
        operation: 'tag',
        sessionId,
        tagAction: 'add',
        tags: ['x', 'y'],
      });
      // @ts-ignore
      expect(result.content[0].text).toContain('Added tags');
      // @ts-ignore
      expect(result.details.tags).toContain('x');
      // @ts-ignore
      expect(result.details.tags).toContain('y');
    });

    it('should remove tags', async () => {
      const createResult: any = await tool.execute('tag_rem1', {
        operation: 'create',
        tags: ['a', 'b'],
      });
      // @ts-ignore
      const sessionId = createResult.details.sessionId;

      const result: any = await tool.execute('tag_rem2', {
        operation: 'tag',
        sessionId,
        tagAction: 'remove',
        tags: ['a'],
      });
      // @ts-ignore
      expect(result.content[0].text).toContain('Removed tags');
      // @ts-ignore
      expect(result.details.tags).not.toContain('a');
      // @ts-ignore
      expect(result.details.tags).toContain('b');
    });
  });

  describe('delete operation', () => {
    it('should delete a session from registry', async () => {
      const createResult: any = await tool.execute('del1', { operation: 'create' });
      // @ts-ignore
      const sessionId = createResult.details.sessionId;

      const result: any = await tool.execute('del2', { operation: 'delete', sessionId });

      // @ts-ignore
      expect(result.content[0].text).toContain('Deleted session from registry');

      // Verify it's gone from list
      const listResult: any = await tool.execute('del3', {
        operation: 'list',
        includeDisposed: true,
      });
      // @ts-ignore
      const deletedSession = listResult.details.sessions.find((s: any) => s.id === sessionId);
      expect(deletedSession).toBeUndefined();
    });

    it('should delete active session if no sessionId provided', async () => {
      // Create a child, making it active
      await tool.execute('del_active1', { operation: 'create' });
      // Now active is child. Delete it.
      const result: any = await tool.execute('del_active2', { operation: 'delete' });
      // @ts-ignore
      expect(result.content[0].text).toContain('Deleted session');

      // Active should now be parent
      const status: any = await tool.execute('del_active3', { operation: 'status' });
      // @ts-ignore
      expect(status.content[0].text).toContain('parent');
    });
  });

  describe('tree operation', () => {
    it('should display session hierarchy', async () => {
      const child1 = await tool.execute('tree1', { operation: 'create', name: 'child-1' });
      const child2 = await tool.execute('tree2', {
        operation: 'create',
        name: 'child-2',
        // parent will be child-1 (active)
      });
      // Switch to parent and create another child directly under parent
      await tool.execute('tree_switch', { operation: 'switch', sessionId: 'parent' });
      await tool.execute('tree3', { operation: 'create', name: 'child-of-parent' });

      const result: any = await tool.execute('tree4', { operation: 'tree' });
      // @ts-ignore
      expect(result.content[0].text).toContain('Session Tree');
      // @ts-ignore
      expect(result.content[0].text).toContain('parent');
      // @ts-ignore
      expect(result.content[0].text).toContain('child-1');
      // @ts-ignore
      expect(result.content[0].text).toContain('child-2');
      // @ts-ignore
      expect(result.content[0].text).toContain('child-of-parent');
    });
  });

  describe('history operation', () => {
    it('should show operation history', async () => {
      await tool.execute('hist1', { operation: 'create', name: 'a' });
      await tool.execute('hist2', { operation: 'create', name: 'b' });
      await tool.execute('switch', { operation: 'switch', sessionId: 'parent' });

      const result: any = await tool.execute('hist3', { operation: 'history', limit: 5 });
      // @ts-ignore
      expect(result.content[0].text).toContain('Operation History');
      // @ts-ignore
      expect(result.details.entries.length).toBeGreaterThanOrEqual(3); // at least 3 creates + switches
    });

    it('should respect limit parameter', async () => {
      // generate some history
      for (let i = 0; i < 5; i++) {
        await tool.execute(`histlim${i}`, { operation: 'create', name: `child-${i}` });
      }
      const result: any = await tool.execute('histlim', { operation: 'history', limit: 3 });
      // @ts-ignore
      expect(result.details.entries).toHaveLength(3);
    });
  });

  describe('status operation', () => {
    it('should show current status', async () => {
      const result: any = await tool.execute('stat1', { operation: 'status' });
      // @ts-ignore
      expect(result.content[0].text).toContain('Session Status');
      // @ts-ignore
      expect(result.content[0].text).toContain('Active Session');
      // @ts-ignore
      expect(result.content[0].text).toContain('Root Session');
      // @ts-ignore
      expect(result.content[0].text).toContain('Total Sessions');
    });

    it('should reflect active session changes', async () => {
      const createResult: any = await tool.execute('stat2', { operation: 'create', name: 'child' });
      // @ts-ignore
      const childId = createResult.details.sessionId;
      await tool.execute('stat3', { operation: 'switch', sessionId: childId });

      const status: any = await tool.execute('stat4', { operation: 'status' });
      // @ts-ignore
      expect(status.content[0].text).toContain(childId);
    });
  });

  describe('diagnostics operation', () => {
    it('should show internal diagnostics', async () => {
      await tool.execute('diag1', { operation: 'create', name: 'test-child' });
      const result: any = await tool.execute('diag2', { operation: 'diagnostics' });

      // @ts-ignore
      expect(result.content[0].text).toContain('Diagnostics');
      // @ts-ignore
      expect(result.details.totalSessions).toBeGreaterThanOrEqual(2);
      // @ts-ignore
      expect(result.details.activeSessionId).toBeDefined();
      // @ts-ignore
      expect(result.details.rootSessionId).toBeDefined();
      // @ts-ignore
      expect(result.details.registryExport).toBeDefined();
    });

    it('should include system metrics in diagnostics', async () => {
      const result: any = await tool.execute('diag_sys', { operation: 'diagnostics' });
      expect(result.details.system).toBeDefined();
      expect(result.details.system.memory).toBeDefined();
      expect(result.details.system.uptime).toBeGreaterThanOrEqual(0);
      expect(result.details.system.nodeVersion).toMatch(/v\d+\.\d+\.\d+/);
      expect(result.details.system.platform).toBeDefined();
      expect(result.content[0].text).toContain('System Uptime');
      expect(result.content[0].text).toContain('Node:');
    });
  });

  describe('concurrency', () => {
    it('should handle concurrent session creation without corruption', async () => {
      const names = ['conc-1', 'conc-2', 'conc-3'];
      const results = await createConcurrent('conc', names);
      results.forEach(assertNoError);
      const ids = results.map((r: any) => r.details.sessionId);
      expect(new Set(ids).size).toBe(3);
      const status = await getStatus('status_after_conc');
      assertTotalSessions(status, 4);
      expect(status.details.activeSession).not.toBeNull();
      const activeId = status.details.activeSession.id;
      const list = await listSessions('list_conc');
      expect(list.details.sessions).toHaveLength(4);
      assertActiveCount(list, 1);
      expect(ids).toContain(activeId);
    });

    it('should handle concurrent switches to different sessions', async () => {
      const s1: any = await tool.execute('c1_conc', { operation: 'create', name: 'c1' });
      const s2: any = await tool.execute('c2_conc', { operation: 'create', name: 'c2' });
      const id1 = s1.details.sessionId;
      const id2 = s2.details.sessionId;

      await Promise.all([
        tool.execute('sw1', { operation: 'switch', sessionId: id1 }),
        tool.execute('sw2', { operation: 'switch', sessionId: id2 }),
      ]);

      const status: any = await tool.execute('status_conc_switch', { operation: 'status' });
      expect(status.details.activeSession).not.toBeNull();
      const activeId = status.details.activeSession.id;
      expect([id1, id2]).toContain(activeId);
    });
  });

  describe('error handling', () => {
    it('should return error for unknown operation', async () => {
      const params: any = { operation: 'unknown' };
      const result: any = await tool.execute('err1', params);
      // @ts-ignore
      expect(result.isError).toBe(true);
      // @ts-ignore
      expect(result.content[0].text).toContain('Unknown operation');
    });

    it('should validate required parameters', async () => {
      const params2: any = { operation: 'rename' };
      const result: any = await tool.execute('err2', params2);
      // @ts-ignore
      expect(result.isError).toBe(true);
      // @ts-ignore
      expect(result.content[0].text).toContain('Name is required');
    });

    it('should catch runtime errors and return isError', async () => {
      // Try to switch to a non-existent parent using getChildren should throw if no children
      // Actually switch with invalid sessionId throws
      const result: any = await tool.execute('err3', { operation: 'switch', sessionId: 'invalid' });
      // @ts-ignore
      expect(result.isError).toBe(true);
      // @ts-ignore
      expect(result.details.error).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full lifecycle: create child, work, switch back, view tree, delete child', async () => {
      const child = await createSession('int1', 'feature-work');
      const childId = child.details.sessionId;
      await switchSession(childId, 'int2');
      let status = await getStatus('int3');
      assertListContains(status, childId);
      await switchSession('parent', 'int4');
      status = await getStatus('int5');
      assertListContains(status, 'parent');
      const tree = await tool.execute('int6', { operation: 'tree' });
      // @ts-ignore
      expect(tree.content[0].text).toContain('feature-work');
      await tool.execute('int7', { operation: 'delete', sessionId: childId });
      const list = await listSessions('int8');
      assertListNotContains(list, 'feature-work');
    });

    it('should support tagging and renaming', async () => {
      const create: any = await tool.execute('tagint1', { operation: 'create', name: 'debugging' });
      // @ts-ignore
      const sessionId = create.details.sessionId;

      // Add tags
      await tool.execute('tagint2', {
        operation: 'tag',
        sessionId,
        tagAction: 'add',
        tags: ['bug', 'high-priority'],
      });

      // Rename
      await tool.execute('tagint3', {
        operation: 'rename',
        sessionId,
        name: 'debugging-v2',
      });

      const info = await tool.execute('tagint4', { operation: 'info', sessionId });
      // @ts-ignore
      expect(info.content[0].text).toContain('debugging-v2');
      // @ts-ignore
      expect(info.content[0].text).toContain('bug');
      // @ts-ignore
      expect(info.content[0].text).toContain('high-priority');
    });
  });
});
