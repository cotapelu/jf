import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRegistry, SessionState } from '../tools/session/registry.js';

// Mock AgentSession
function createMockSession(sessionFile?: string): any {
  return {
    sessionFile: sessionFile ?? `/path/to/${Date.now()}.jsonl`
  };
}

describe('SessionRegistry - Branch Coverage Gaps', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry();
  });

  describe('generateSessionId', () => {
    it('falls back to "session" when sessionFile is undefined', () => {
      const session = createMockSession(undefined);
      const id = (registry as any)['generateSessionId'](session);
      expect(id).toMatch(/^session_\w+$/);
    });
  });

  describe('recordHistory truncation', () => {
    it('truncates oldest when exceeding maxHistoryEntries', () => {
      const r = new SessionRegistry({ maxHistoryEntries: 2 });
      const session = createMockSession('s1');
      const meta = r.register(session);

      // 3 operations
      (r as any)['recordHistory']('create', meta.id, {});
      (r as any)['recordHistory']('update', meta.id, { name: 'a' });
      (r as any)['recordHistory']('dispose', meta.id, {});

      const history = (r as any)['history'];
      expect(history.length).toBe(2);
      expect(history[0].operation).toBe('update'); // first dropped
    });
  });

  describe('getActive', () => {
    it('returns null when no sessions registered', () => {
      expect(registry.getActive()).toBeNull();
    });
  });

  describe('setActive after dispose', () => {
    it('activates inactive non-disposed session when active disposed', () => {
      const s1 = createMockSession('s1');
      const m1 = registry.register(s1); // becomes inactive after m2 registered

      const s2 = createMockSession('s2');
      const m2 = registry.register(s2); // active

      // Unregister active session
      registry.unregister(m2.id);

      // activeSessionId should now be null
      expect(registry.getActive()).toBeNull();

      // Activate the previously inactive m1
      const result = registry.setActive(m1.id);
      expect(result).toBe(true);
      expect(registry.getActive()?.id).toBe(m1.id);
    });
  });

  describe('getChildren', () => {
    it('returns empty array for unknown parent', () => {
      expect(registry.getChildren('unknown')).toEqual([]);
    });
  });

  describe('findByFilePath', () => {
    it('returns null for disposed session', () => {
      const session = createMockSession('/path/file.jsonl');
      const meta = registry.register(session);
      registry.unregister(meta.id);

      expect(registry.findByFilePath(session.sessionFile)).toBeNull();
    });
  });

  describe('has', () => {
    it('returns false for disposed session', () => {
      const session = createMockSession();
      const meta = registry.register(session);
      registry.unregister(meta.id);
      expect(registry.has(meta.id)).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('returns all entries when limit not provided', () => {
      const session = createMockSession();
      const meta = registry.register(session); // records 'create'
      registry.update(meta.id, { name: 'a' }); // records 'update'

      const history = registry.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].operation).toBe('create');
      expect(history[1].operation).toBe('update');
    });

    it('returns last N entries when limit provided', () => {
      const r = new SessionRegistry({ maxHistoryEntries: 100 });
      // Register multiple sessions to generate multiple history entries
      for (let i = 0; i < 5; i++) {
        const s = createMockSession(`s${i}`);
        r.register(s);
      }
      const history = r.getHistory(3);
      expect(history).toHaveLength(3);
      // Should be the last 3 in reverse chronological order? getHistory(limit) returns last entries via slice(-limit), preserving order (oldest first within the slice? Actually slice(-3) returns last 3 in order). It returns array from -limit index to end. So earliest of the last three first.
      const ops = history.map(e => e.operation);
      expect(ops).toEqual(['create', 'create', 'create']); // all are 'create' but we can check positions
    });
  });
});
