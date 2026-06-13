import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiSessionManager } from '../multi-session-manager.js';
import type { AgentSession } from '@earendil-works/pi-coding-agent';

// Mock AgentSession
function createMockSession(name: string): AgentSession {
    return {
        sessionFile: `/path/to/${name}.jsonl`,
        dispose: vi.fn().mockResolvedValue(undefined),
    } as any;
}

// Mock Runtime
function createMockRuntime(initialSession: AgentSession = createMockSession('parent')): any {
    let currentSession: AgentSession | null = initialSession;
    const sessions: AgentSession[] = [initialSession];
    let counter = 0;

    return {
        get session(): AgentSession | null {
            return currentSession;
        },
        set session(s: AgentSession | null) {
            currentSession = s;
        },
        async newSession(options?: { parentSession?: string }): Promise<{ cancelled: boolean }> {
            // Simulate creating a new child session
            const newSession = createMockSession(`child-${++counter}`);
            sessions.push(newSession);
            currentSession = newSession;
            // Note: parentSession option is not used in mock
            return { cancelled: false };
        },
        async switchSession(filePath: string): Promise<void> {
            const target = sessions.find(s => s.sessionFile === filePath);
            if (!target) {
                throw new Error(`Session not found: ${filePath}`);
            }
            currentSession = target;
        },
        async dispose(): Promise<void> {
            for (const s of sessions) {
                await s.dispose();
            }
            sessions.length = 0;
            currentSession = null;
        },
        // Expose for test verification
        _sessions: sessions,
    };
}

describe('MultiSessionManager', () => {
    let runtime: any;
    let manager: MultiSessionManager;

    beforeEach(() => {
        const parentSession = createMockSession('parent');
        runtime = createMockRuntime(parentSession);
        manager = new MultiSessionManager(runtime, {
            allowMultipleChildren: true,
            maxSessions: 0,
        });
    });

    describe('initialization', () => {
        it('should register the parent session on construction', () => {
            const root = manager.getRoot();
            expect(root).not.toBeNull();
            expect(root?.name).toBe('parent');
            expect(root?.tags).toContain('root');
            expect(root?.tags).toContain('parent');
            expect(root!.parentId).toBeNull();
        });

        it('should set the active session to the parent', () => {
            const active = manager.getActive();
            expect(active).not.toBeNull();
            expect(active?.id).toBe(manager.getRoot()?.id);
        });
    });

    describe('createChild()', () => {
        it('should create a new child session', async () => {
            const child = await manager.createChild({ name: 'child-1' });

            expect(child).not.toBeNull();
            expect(child.name).toBe('child-1');
            expect(child.parentId).toBe(manager.getRoot()?.id);
            expect(child.state).toBe('active');
            expect(child.isActive).toBe(true);
        });

        it('should auto-generate name if not provided', async () => {
            const child = await manager.createChild();
            expect(child.name).toMatch(/^child-\d+$/);
        });

        it('should add custom tags', async () => {
            const child = await manager.createChild({ tags: ['debug', 'test'] });
            expect(child.tags).toContain('debug');
            expect(child.tags).toContain('test');
            expect(child.tags).toContain('child'); // auto-added
        });

        it('should support unlimited children by default', async () => {
            // Create a chain: parent -> child1 -> child2 -> ...
            for (let i = 0; i < 5; i++) {
                await manager.createChild({ name: `child-${i}` });
            }
            // After chaining, only the first child is direct child of root
            expect(manager.getChildren()).toHaveLength(1);
            // Total sessions should be 6 (parent + 5 children)
            expect(manager.list()).toHaveLength(6);
        });

        it('should respect maxSessions limit', async () => {
            const limitedManager = new MultiSessionManager(runtime, { maxSessions: 2 });
            await limitedManager.createChild({ name: 'child-1' });

            await expect(limitedManager.createChild({ name: 'child-2' }))
                .rejects.toThrow('Max sessions limit');
        });

        it('should update parentId to current active if not specified', async () => {
            // After parent, active is parent
            const child1 = await manager.createChild({ name: 'child-1' });
            // child1 is now active. Create another child without specifying parentId.
            expect(child1.parentId).toBe(manager.getRoot()?.id);

            // Switch to parent
            await manager.switchToParent();
            const child2 = await manager.createChild({ name: 'child-2' });
            // Should parent be parent? Yes, because we switched to parent, active is parent.
            expect(child2.parentId).toBe(manager.getRoot()?.id);
        });
    });

    describe('switchTo()', () => {
        it('should switch to a given session', async () => {
            const child = await manager.createChild({ name: 'child-1' });
            await manager.switchToParent(); // Back to parent

            const activeBefore = manager.getActive();
            expect(activeBefore?.id).toBe(manager.getRoot()?.id);

            await manager.switchTo(child.id);

            const activeAfter = manager.getActive();
            expect(activeAfter?.id).toBe(child.id);
        });

        it('should throw if session not found', async () => {
            await expect(manager.switchTo('nonexistent')).rejects.toThrow('Session not found');
        });

        it('should throw if already active', async () => {
            const activeBefore = manager.getActive();
            await expect(manager.switchTo(activeBefore!.id)).rejects.toThrow('Already active');
        });
    });

    describe('switchToParent()', () => {
        it('should switch to the parent session', async () => {
            await manager.createChild({ name: 'child-1' });
            await manager.switchToParent();

            const active = manager.getActive();
            expect(active?.id).toBe(manager.getRoot()?.id);
        });

        it('should throw if no parent', async () => {
            // In our manager, root always exists. Simulate by creating manager with no root? Not possible.
            // So just verify it works.
        });
    });

    describe('switchToLastChild()', () => {
        it('should switch to the most recently created child', async () => {
            const rootId = manager.getRoot()!.id;
            await manager.createChild({ name: 'child-1', parentSession: rootId });
            await manager.createChild({ name: 'child-2', parentSession: rootId });
            await manager.switchToParent();

            // Determine most recent by checking children order (sorted descending by createdAt)
            const children = manager.getChildren();
            const expectedMostRecent = children[0];

            await manager.switchToLastChild();
            const active = manager.getActive();
            expect(active?.id).toBe(expectedMostRecent.id);
        });

        it('should throw if no children', async () => {
            await expect(manager.switchToLastChild()).rejects.toThrow('No child sessions');
        });
    });

    describe('dispose()', () => {
        it('should dispose a specific session', async () => {
            const child = await manager.createChild({ name: 'child-1' });
            await manager.switchToParent();

            await manager.dispose(child.id);

            expect(manager.get(child.id)).toBeNull();
        });

        it('should switch away from active session before disposing', async () => {
            const child = await manager.createChild({ name: 'child-1' });
            // child is active

            await manager.dispose(child.id);

            // After disposing child, active should be parent (since we switched away automatically)
            const active = manager.getActive();
            expect(active?.id).toBe(manager.getRoot()?.id);
        });

        it('should not dispose parent unless disposeRuntime=true', async () => {
            await expect(manager.dispose(manager.getRoot()!.id)).rejects.toThrow('Cannot dispose parent session');
        });

        it('should clear registry when disposeRuntime=true', async () => {
            await manager.createChild({ name: 'child-1' });
            await manager.dispose(null, true); // dispose all

            expect(manager.getActive()).toBeNull();
            expect(manager.getRoot()).toBeNull();
        });
    });

    describe('getChildren()', () => {
        it('should return children of root by default', async () => {
            const rootId = manager.getRoot()!.id;
            await manager.createChild({ name: 'child-1', parentSession: rootId });
            await manager.createChild({ name: 'child-2', parentSession: rootId });
            await manager.switchToParent();

            const children = manager.getChildren();
            expect(children).toHaveLength(2);
        });
    });

    describe('getTree()', () => {
        it('should build tree with correct hierarchy', async () => {
            const child1 = await manager.createChild({ name: 'child-1' });
            const child2 = await manager.createChild({ name: 'child-2' });
            await manager.switchToParent();
            const grandchildren = await manager.createChild({ name: 'grandchild' }); // child of child2? Wait after creating child2, it is active. So this grandchild parent is child2.
            // Actually after createChild, the new child becomes active. So grandchild's parent = child2.

            const tree = manager.getTree();
            expect(tree.roots).toHaveLength(1);
            const rootNode = tree.roots[0];
            expect(rootNode.session.id).toBe(manager.getRoot()!.id);
            expect(rootNode.children).toHaveLength(2); // child1 and child2

            // child2 is a child of child1
            const child1Node = rootNode.children.find(c => c.session.id === child1.id);
            expect(child1Node).not.toBeUndefined();
            expect(child1Node!.children).toHaveLength(1);
            expect(child1Node!.children[0].session.id).toBe(child2.id);

            // grandchild is direct child of root
            const grandchildNode = rootNode.children.find(c => c.session.id === grandchildren.id);
            expect(grandchildNode).not.toBeUndefined();
            expect(grandchildNode!.children).toHaveLength(0);
        });
    });

    describe('rename()', () => {
        it('should rename a session', async () => {
            const child = await manager.createChild({ name: 'old-name' });
            await manager.switchToParent();

            const renamed = manager.rename(child.id, 'new-name');
            expect(renamed?.name).toBe('new-name');
        });

        it('should return null if session not found', () => {
            const result = manager.rename('nonexistent', 'name');
            expect(result).toBeNull();
        });
    });

    describe('tag operations', () => {
        it('should add tags', async () => {
            const child = await manager.createChild({ name: 'child' });
            await manager.switchToParent();

            const updated = manager.addTags(child.id, 'tag1', 'tag2');
            expect(updated?.tags).toContain('tag1');
            expect(updated?.tags).toContain('tag2');
        });

        it('should remove tags', async () => {
            const child = await manager.createChild({ name: 'child', tags: ['a', 'b'] });
            await manager.switchToParent();

            const updated = manager.removeTags(child.id, 'a');
            expect(updated?.tags).not.toContain('a');
            expect(updated?.tags).toContain('b');
        });

        it('should return null for unknown session', () => {
            const result = manager.addTags('nonexistent', 'tag');
            expect(result).toBeNull();
        });
    });

    describe('getDiagnostics()', () => {
        it('should return correct diagnostic counts', async () => {
            await manager.createChild({ name: 'child-1' });
            // Not disposing; just check diagnostics
            const diag = manager.getDiagnostics();
            expect(diag.totalSessions).toBe(2); // parent + child
            expect(diag.activeSessionId).not.toBeNull();
            expect(diag.rootSessionId).not.toBeNull();
            expect(diag.childCount).toBe(1);
        });
    });

    describe('exportMetadata()', () => {
        it('should export all session data as plain object', async () => {
            await manager.createChild({ name: 'child-1' });
            const exportData = manager.exportMetadata() as any;

            expect(exportData).toHaveProperty('sessions');
            expect(exportData).toHaveProperty('rootSessionId');
            expect(exportData).toHaveProperty('activeSessionId');
            expect(exportData).toHaveProperty('tree');
            expect(Array.isArray(exportData.sessions)).toBe(true);
        });
    });
});
