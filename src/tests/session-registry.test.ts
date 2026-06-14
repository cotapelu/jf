import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionRegistry,
  SessionMetadata,
  SessionState,
  SessionHistoryEntry,
} from '../tools/session/registry.js';

// Mock AgentSession minimal interface
function createMockSession(id: string): any {
  return {
    sessionFile: `/path/to/${id}.jsonl`,
  };
}

describe('SessionRegistry', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry();
  });

  describe('register()', () => {
    it('should register a new session with auto-generated ID', () => {
      const session = createMockSession('session1');
      const meta = registry.register(session);

      expect(meta).toBeInstanceOf(Object);
      expect(meta.id).toMatch(/^session_\w+$/);
      expect(meta.filePath).toBe(session.sessionFile);
      expect(meta.parentId).toBeNull();
      expect(meta.state).toBe(SessionState.ACTIVE);
      expect(meta.isActive).toBe(true);
      expect(meta.createdAt).toBeInstanceOf(Date);
    });

    it('should register with custom name and tags', () => {
      const session = createMockSession('session2');
      const meta = registry.register(session, {
        name: 'My Session',
        tags: ['debug', 'test'],
      });

      expect(meta.name).toBe('My Session');
      expect(meta.tags).toEqual(['debug', 'test']);
    });

    it('should set parentId when provided', () => {
      const parentSession = createMockSession('parent');
      const parentMeta = registry.register(parentSession, { name: 'Parent' });

      const childSession = createMockSession('child');
      const childMeta = registry.register(childSession, {
        parentId: parentMeta.id,
      });

      expect(childMeta.parentId).toBe(parentMeta.id);
    });

    it('should automatically deactivate previous active session', () => {
      const session1 = createMockSession('s1');
      const meta1 = registry.register(session1);

      const session2 = createMockSession('s2');
      const meta2 = registry.register(session2);

      expect(meta1.isActive).toBe(false);
      expect(meta1.state).toBe(SessionState.INACTIVE);
      expect(meta2.isActive).toBe(true);
      expect(meta2.state).toBe(SessionState.ACTIVE);
      expect(registry.getActive()?.id).toBe(meta2.id);
    });

    it('should throw if session already registered', () => {
      const session = createMockSession('s');
      registry.register(session);

      expect(() => registry.register(session)).toThrow('Session already registered');
    });
  });

  describe('get()', () => {
    it('should return session metadata by ID', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);

      const found = registry.get(meta.id);
      expect(found).toBe(meta);
    });

    it('should return null for non-existent ID', () => {
      const found = registry.get('nonexistent');
      expect(found).toBeNull();
    });

    it('should return null for disposed sessions', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);
      registry.unregister(meta.id);

      expect(registry.get(meta.id)).toBeNull();
    });
  });

  describe('list()', () => {
    it('should list all non-disposed sessions by default', () => {
      const s1 = createMockSession('s1');
      const m1 = registry.register(s1);

      const s2 = createMockSession('s2');
      const m2 = registry.register(s2, { parentId: m1.id });

      const list = registry.list();
      expect(list).toHaveLength(2);
    });

    it('should include disposed sessions when requested', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);
      registry.unregister(meta.id);

      const list = registry.list({ includeDisposed: true });
      expect(list).toHaveLength(1);
      expect(list[0].state).toBe(SessionState.DISPOSED);
    });

    it('should sort by created date descending by default', () => {
      vi.useFakeTimers();

      const s1 = createMockSession('s1');
      vi.setSystemTime(new Date('2024-01-01'));
      const m1 = registry.register(s1);

      const s2 = createMockSession('s2');
      vi.setSystemTime(new Date('2024-01-02'));
      const m2 = registry.register(s2);

      const list = registry.list();
      expect(list[0].id).toBe(m2.id);
      expect(list[1].id).toBe(m1.id);

      vi.useRealTimers();
    });
  });

  describe('setActive()', () => {
    it('should set a session as active', () => {
      const s1 = createMockSession('s1');
      const m1 = registry.register(s1);

      const s2 = createMockSession('s2');
      const m2 = registry.register(s2);

      registry.setActive(m1.id);

      expect(m1.isActive).toBe(true);
      expect(m1.state).toBe(SessionState.ACTIVE);
      expect(m2.isActive).toBe(false);
      expect(m2.state).toBe(SessionState.INACTIVE);
      expect(registry.getActive()?.id).toBe(m1.id);
    });

    it('should return false for non-existent session', () => {
      const result = registry.setActive('nonexistent');
      expect(result).toBe(false);
    });

    it('should return false for disposed session', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);
      registry.unregister(meta.id);

      const result = registry.setActive(meta.id);
      expect(result).toBe(false);
    });
  });

  describe('unregister()', () => {
    it('should mark session as disposed', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);

      const result = registry.unregister(meta.id);

      expect(result).toBe(true);
      expect(meta.state).toBe(SessionState.DISPOSED);
      expect(meta.isActive).toBe(false);
      expect(meta.sessionRef).toBeNull();
    });

    it('should clear activeSessionId if unregistering active session', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);

      expect(registry.getActive()?.id).toBe(meta.id);
      registry.unregister(meta.id);

      expect(registry.getActive()).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getChildren()', () => {
    it('should return direct children of a parent', () => {
      const parent = createMockSession('parent');
      const parentMeta = registry.register(parent);

      const child1 = createMockSession('child1');
      const child1Meta = registry.register(child1, { parentId: parentMeta.id });

      const child2 = createMockSession('child2');
      const child2Meta = registry.register(child2, { parentId: parentMeta.id });

      const grandchild = createMockSession('grandchild');
      const grandchildMeta = registry.register(grandchild, { parentId: child1Meta.id });

      const children = registry.getChildren(parentMeta.id);
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toContain(child1Meta.id);
      expect(children.map((c) => c.id)).toContain(child2Meta.id);
      expect(children.map((c) => c.id)).not.toContain(grandchildMeta.id); // Not direct child
    });

    it('should return empty array for session with no children', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);

      const children = registry.getChildren(meta.id);
      expect(children).toEqual([]);
    });
  });

  describe('getTree()', () => {
    it('should build correct tree structure', () => {
      const root = createMockSession('root');
      const rootMeta = registry.register(root);

      const child1 = createMockSession('child1');
      const child1Meta = registry.register(child1, { parentId: rootMeta.id });

      const child2 = createMockSession('child2');
      const child2Meta = registry.register(child2, { parentId: rootMeta.id });

      const grandchild = createMockSession('grandchild');
      const grandchildMeta = registry.register(grandchild, { parentId: child1Meta.id });

      const tree = registry.getTree();

      expect(tree.roots).toHaveLength(1);
      expect(tree.roots[0].session.id).toBe(rootMeta.id);
      expect(tree.roots[0].children).toHaveLength(2);

      const child1Node = tree.roots[0].children.find((c) => c.session.id === child1Meta.id);
      expect(child1Node).toBeDefined();
      expect(child1Node!.children).toHaveLength(1);
      expect(child1Node!.children[0].session.id).toBe(grandchildMeta.id);

      const child2Node = tree.roots[0].children.find((c) => c.session.id === child2Meta.id);
      expect(child2Node).toBeDefined();
      expect(child2Node!.children).toHaveLength(0);
    });
  });

  describe('findByFilePath()', () => {
    it('should find session by file path', () => {
      const session = createMockSession('s123');
      const meta = registry.register(session);

      const found = registry.findByFilePath(meta.filePath);
      expect(found).toBe(meta);
    });

    it('should return null for non-existent file path', () => {
      const found = registry.findByFilePath('/nonexistent/file.jsonl');
      expect(found).toBeNull();
    });
  });

  describe('has()', () => {
    it('should return true for existing non-disposed session', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);

      expect(registry.has(meta.id)).toBe(true);
    });

    it('should return false for disposed session', () => {
      const session = createMockSession('s');
      const meta = registry.register(session);
      registry.unregister(meta.id);

      expect(registry.has(meta.id)).toBe(false);
    });

    it('should return false for non-existent session', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should clear all sessions', () => {
      const s1 = createMockSession('s1');
      registry.register(s1);

      const s2 = createMockSession('s2');
      registry.register(s2);

      registry.clear();

      expect(registry.count).toBe(0);
      expect(registry.activeCount).toBe(0);
    });
  });

  describe('getHistory()', () => {
    it('should record operations in history', () => {
      const session = createMockSession('s');
      registry.register(session, { name: 'test' });

      const history = registry.getHistory();
      expect(history.length).toBeGreaterThan(0);

      const createEntry = history.find((h) => h.operation === 'create');
      expect(createEntry).toBeDefined();
      expect(createEntry?.sessionId).toBeDefined();
      expect(createEntry?.details.name).toBe('test');
    });

    it('should respect limit parameter', () => {
      const session = createMockSession('s');
      registry.register(session);

      const history = registry.getHistory(1);
      expect(history).toHaveLength(1);
    });
  });

  describe('count and activeCount', () => {
    it('should correctly report counts', () => {
      const s1 = createMockSession('s1');
      registry.register(s1);

      const s2 = createMockSession('s2');
      registry.register(s2);

      expect(registry.count).toBe(2);
      expect(registry.activeCount).toBe(1); // Only one active at a time
    });
  });

  describe('WeakRef garbage collection', () => {
    it('should clear sessionRef after dispose', () => {
      const session = createMockSession('gc-test');
      const meta = registry.register(session);

      expect(meta.sessionRef).not.toBeNull();

      registry.unregister(meta.id);

      expect(meta.sessionRef).toBeNull();
      expect(meta.state).toBe(SessionState.DISPOSED);
    });

    it('should remove disposed sessions from list', () => {
      const session1 = createMockSession('keep');
      const session2 = createMockSession('dispose');

      const meta1 = registry.register(session1);
      const meta2 = registry.register(session2);

      expect(registry.list()).toHaveLength(2);

      registry.unregister(meta2.id);

      expect(registry.list()).toHaveLength(1);
      expect(registry.get(meta1.id)).toBe(meta1);
      expect(registry.get(meta2.id)).toBeNull();
    });

    it('should allow GC of disposed session refs', () => {
      const session = createMockSession('gctest');
      const meta = registry.register(session);
      registry.unregister(meta.id);
      expect(meta.sessionRef).toBeNull();
    });
  });
});

describe('SessionMetadata', () => {
  it('should have correct structure', () => {
    const session = createMockSession('s');
    const registry = new SessionRegistry();
    const meta = registry.register(session);

    expect(meta).toHaveProperty('id');
    expect(meta).toHaveProperty('filePath');
    expect(meta).toHaveProperty('parentId');
    expect(meta).toHaveProperty('createdAt');
    expect(meta).toHaveProperty('name');
    expect(meta).toHaveProperty('tags');
    expect(meta).toHaveProperty('state');
    expect(meta).toHaveProperty('sessionRef');
    expect(meta).toHaveProperty('isActive');
  });
});

describe('SessionState', () => {
  it('should have correct enum values', () => {
    expect(SessionState.ACTIVE).toBe('active');
    expect(SessionState.INACTIVE).toBe('inactive');
    expect(SessionState.DISPOSED).toBe('disposed');
  });
});

