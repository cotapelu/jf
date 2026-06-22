import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager, CommandState, getStateManager, resetStateManager } from '../state-manager.js';

// Mock a minimal ExtensionContext
const createMockContext = (id?: string): any => ({
  id: id || `ctx-${Math.random().toString(36).substr(2, 9)}`
});

// Helper to create a custom CommandState implementation
class TestState implements CommandState {
  isDirty = false;
  mutex?: any;
  listeners?: Set<() => void>;
  _filePath?: string;

  // Track calls
  saveCalls = 0;
  loadCalls = 0;

  markDirty(): void {
    this.isDirty = true;
    this.listeners?.forEach(l => l());
  }

  subscribe(listener: () => void): () => void {
    if (!this.listeners) this.listeners = new Set();
    this.listeners.add(listener);
    return () => this.listeners?.delete(listener);
  }

  async save(_ctx: any): Promise<void> {
    this.saveCalls++;
  }

  async load(_ctx: any): Promise<boolean> {
    this.loadCalls++;
    return true; // simulate loaded
  }

  getSnapshot(): any {
    return { isDirty: this.isDirty };
  }
}

describe('StateManager', () => {
  let manager: StateManager;
  let ctx: any;

  beforeEach(() => {
    // Create fresh manager and context for each test
    manager = new StateManager();
    ctx = createMockContext();
  });

  describe('getOrCreateState', () => {
    it('should create generic state when StateClass not provided', () => {
      const state = manager.getOrCreateState('cmd1', ctx);
      expect(state).toBeDefined();
      expect(state.isDirty).toBe(false);
    });

    it('should create custom state when StateClass provided', () => {
      const state = manager.getOrCreateState('cmd2', ctx, TestState);
      expect(state).toBeInstanceOf(TestState);
    });

    it('should set filePath when persistencePath provided', () => {
      const state = manager.getOrCreateState('cmd3', ctx, undefined, (c, name) => `/path/${name}.json`);
      expect(state._filePath).toBe('/path/cmd3.json');
    });

    it('should return same state on subsequent calls', () => {
      const state1 = manager.getOrCreateState('cmd1', ctx);
      const state2 = manager.getOrCreateState('cmd1', ctx);
      expect(state1).toBe(state2);
    });

    it('should separate states by context', () => {
      const ctx2 = createMockContext();
      const state1 = manager.getOrCreateState('cmd', ctx);
      const state2 = manager.getOrCreateState('cmd', ctx2);
      expect(state1).not.toBe(state2);
    });
  });

  describe('restoreState', () => {
    it('should load from file when _filePath exists and return true', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState, (c, n) => `/path/${n}.json`);
      const loaded = await manager.restoreState('cmd', ctx);
      expect(loaded).toBe(true);
      expect(state.loadCalls).toBe(1);
    });

    it('should return false when load returns false', async () => {
      // Override state load to return false
      const state = manager.getOrCreateState('cmd', ctx, class extends TestState {
        async load(_c: any): Promise<boolean> { return false; }
      }, (c, n) => `/path/${n}.json`);
      const loaded = await manager.restoreState('cmd', ctx);
      expect(loaded).toBe(false);
    });

    it('should handle load errors and return false', async () => {
      const state = manager.getOrCreateState('cmd', ctx, class extends TestState {
        async load(_c: any): Promise<boolean> { throw new Error('fail'); }
      }, (c, n) => `/path/${n}.json`);
      const loaded = await manager.restoreState('cmd', ctx);
      expect(loaded).toBe(false);
    });

    it('should not try to load when no _filePath', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState);
      const loaded = await manager.restoreState('cmd', ctx);
      expect(loaded).toBe(false);
      expect(state.loadCalls).toBe(0);
    });
  });

  describe('saveStateIfDirty', () => {
    it('should save when dirty and _filePath exists', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState, (c, n) => `/path/${n}.json`);
      state.markDirty();
      await manager.saveStateIfDirty('cmd', ctx);
      expect(state.saveCalls).toBe(1);
      expect(state.isDirty).toBe(false);
    });

    it('should not save when not dirty', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState, (c, n) => `/path/${n}.json`);
      // Not dirty by default
      await manager.saveStateIfDirty('cmd', ctx);
      expect(state.saveCalls).toBe(0);
    });

    it('should not save when no _filePath and still clear dirty flag', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState);
      state.markDirty();
      await manager.saveStateIfDirty('cmd', ctx);
      expect(state.saveCalls).toBe(0);
      expect(state.isDirty).toBe(false); // dirty cleared even without file
    });

    it('should handle save errors and keep dirty flag', async () => {
      const state = manager.getOrCreateState('cmd', ctx, class extends TestState {
        async save(_c: any): Promise<void> { throw new Error('save fail'); }
      }, (c, n) => `/path/${n}.json`);
      state.markDirty();
      // Should not throw, just log
      await expect(manager.saveStateIfDirty('cmd', ctx)).resolves.toBeUndefined();
      expect(state.isDirty).toBe(true); // remains dirty after error
    });

    it('should clear dirty flag after successful save', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState, (c, n) => `/path/${n}.json`);
      state.markDirty();
      await manager.saveStateIfDirty('cmd', ctx);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('saveAllDirty', () => {
    it('should save all dirty states', async () => {
      const state1 = manager.getOrCreateState('cmd1', ctx, TestState, (c, n) => `/path/${n}.json`);
      const state2 = manager.getOrCreateState('cmd2', ctx, TestState, (c, n) => `/path/${n}.json`);
      state1.markDirty();
      state2.markDirty();
      await manager.saveAllDirty(ctx);
      expect(state1.saveCalls).toBe(1);
      expect(state2.saveCalls).toBe(1);
    });

    it('should not save non-dirty states', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState, (c, n) => `/path/${n}.json`);
      // Not dirty
      await manager.saveAllDirty(ctx);
      expect(state.saveCalls).toBe(0);
    });

    it('should continue even if one save fails', async () => {
      const state1 = manager.getOrCreateState('cmd1', ctx, class extends TestState {
        async save(_c: any): Promise<void> { throw new Error('fail'); }
      }, (c, n) => `/path/${n}.json`);
      const state2 = manager.getOrCreateState('cmd2', ctx, TestState, (c, n) => `/path/${n}.json`);
      state1.markDirty();
      state2.markDirty();
      await manager.saveAllDirty(ctx);
      expect(state2.saveCalls).toBe(1);
    });
  });

  describe('getState', () => {
    it('should return state when exists', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      expect(manager.getState('cmd', ctx)).toBe(state);
    });

    it('should return undefined when no state', () => {
      expect(manager.getState('nonexistent', ctx)).toBeUndefined();
    });
  });

  describe('hasState', () => {
    it('should return true if state exists', () => {
      manager.getOrCreateState('cmd', ctx);
      expect(manager.hasState('cmd', ctx)).toBe(true);
    });

    it('should return false if no state', () => {
      expect(manager.hasState('nonexistent', ctx)).toBe(false);
    });
  });

  describe('markDirty', () => {
    it('should mark state as dirty', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      manager.markDirty('cmd', ctx);
      expect(state.isDirty).toBe(true);
    });

    it('should call state.markDirty', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      const spy = vi.spyOn(state, 'markDirty');
      manager.markDirty('cmd', ctx);
      expect(spy).toHaveBeenCalled();
    });

    it('should do nothing if state not found', () => {
      // Should not throw
      manager.markDirty('nonexistent', ctx);
    });
  });

  describe('clearContext', () => {
    it('should save all dirty states before clearing', async () => {
      const state = manager.getOrCreateState('cmd', ctx, TestState, (c, n) => `/path/${n}.json`);
      state.markDirty();
      await manager.clearContext(ctx);
      expect(state.saveCalls).toBe(1);
    });

    it('should clear all states for context', () => {
      manager.getOrCreateState('cmd1', ctx);
      manager.getOrCreateState('cmd2', ctx);
      manager.clearContext(ctx);
      expect(manager.getCommandNames(ctx)).toEqual([]);
    });
  });

  describe('getCommandNames', () => {
    it('should return list of command names with state', () => {
      manager.getOrCreateState('cmd1', ctx);
      manager.getOrCreateState('cmd2', ctx);
      const names = manager.getCommandNames(ctx);
      expect(names).toContain('cmd1');
      expect(names).toContain('cmd2');
    });

    it('should return empty array for context with no states', () => {
      expect(manager.getCommandNames(ctx)).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct counts', () => {
      manager.getOrCreateState('cmd1', ctx);
      manager.getOrCreateState('cmd2', ctx);
      const stats = manager.getStats(ctx);
      expect(stats.commandCount).toBe(2);
      expect(stats.dirtyCount).toBe(0);
    });

    it('should count dirty states', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      state.isDirty = true; // manually set
      const stats = manager.getStats(ctx);
      expect(stats.dirtyCount).toBe(1);
    });

    it('should return zero for unknown context', () => {
      const otherCtx = createMockContext();
      const stats = manager.getStats(otherCtx);
      expect(stats).toEqual({ commandCount: 0, dirtyCount: 0 });
    });
  });

  describe('createGenericState', () => {
    it('should have isDirty getter/setter', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      expect(state.isDirty).toBe(false);
      state.isDirty = true;
      expect(state.isDirty).toBe(true);
    });

    it('should notify listeners on dirty set', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      const listener = vi.fn();
      state.subscribe(listener);
      state.isDirty = true;
      expect(listener).toHaveBeenCalled();
    });

    it('subscribe should return unsubscribe function', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      const listener = vi.fn();
      const unsubscribe = state.subscribe(listener);
      unsubscribe();
      state.isDirty = true;
      expect(listener).not.toHaveBeenCalled();
    });

    it('save should be noop', async () => {
      const state = manager.getOrCreateState('cmd', ctx);
      await expect(state.save(ctx)).resolves.toBeUndefined();
    });

    it('load should return false', async () => {
      const state = manager.getOrCreateState('cmd', ctx);
      const result = await state.load(ctx);
      expect(result).toBe(false);
    });

    it('getSnapshot should return isDirty', () => {
      const state = manager.getOrCreateState('cmd', ctx);
      state.isDirty = true;
      expect(state.getSnapshot()).toEqual({ isDirty: true });
    });
  });

  describe('getStateManager singleton', () => {
    it('should return same instance on multiple calls', () => {
      const sm1 = getStateManager();
      const sm2 = getStateManager();
      expect(sm1).toBe(sm2);
    });

    it('resetStateManager should clear singleton', () => {
      const sm1 = getStateManager();
      resetStateManager();
      const sm2 = getStateManager();
      expect(sm1).not.toBe(sm2);
    });
  });
});
