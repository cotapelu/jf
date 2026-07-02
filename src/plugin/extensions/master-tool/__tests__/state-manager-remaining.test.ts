import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateManager, getStateManager, resetStateManager } from "../state-manager.js";
import type { CommandState } from "../state-manager.js";

function makeGenericState(): CommandState {
  // Create a generic state object via StateManager or directly from createGenericState (not exported).
  // We'll use StateManager to get one.
  const sm = new StateManager();
  const ctx = {};
  return sm.getOrCreateState("tmp", ctx);
}

describe("StateManager Remaining Coverage", () => {
  let sm: StateManager;
  let ctx: any;

  beforeEach(() => {
    sm = new StateManager();
    ctx = {};
    resetStateManager();
  });

  describe("saveStateIfDirty", () => {
    it("should return early if state is undefined", async () => {
      await sm.saveStateIfDirty("nonexistent", ctx);
      // no throw
    });

    it("should not call save if state is not dirty", async () => {
      const state = sm.getOrCreateState("cmd", ctx);
      state.isDirty = false;
      // state.save may not exist or be dummy; just ensure no error
      await sm.saveStateIfDirty("cmd", ctx);
      // still clean
      expect(state.isDirty).toBe(false);
    });

    it("should call save and clear dirty when dirty and _filePath exists", async () => {
      const state = sm.getOrCreateState("cmd", ctx);
      // Configure as persistent
      state._filePath = "/tmp/test.json";
      // Replace save with spy
      const saveSpy = vi.fn().mockResolvedValue(undefined);
      (state as any).save = saveSpy;
      state.isDirty = true;
      await sm.saveStateIfDirty("cmd", ctx);
      expect(saveSpy).toHaveBeenCalled();
      expect(state.isDirty).toBe(false);
    });

    it("should not call save if dirty but no _filePath", async () => {
      const state = sm.getOrCreateState("cmd", ctx);
      const saveSpy = vi.fn().mockResolvedValue(undefined);
      (state as any).save = saveSpy;
      state.isDirty = true;
      // no _filePath
      await sm.saveStateIfDirty("cmd", ctx);
      expect(saveSpy).not.toHaveBeenCalled();
      // isDirty remains? Actually code: after try clause it sets isDirty = false outside conditional. Wait check code:
      // try { if (state._filePath) await state.save(ctx); state.isDirty = false; } catch {}
      // So even if no _filePath, it still sets isDirty = false after try block. Let's verify:
      // From code:
      // try {
      //   if (state._filePath) { await state.save(ctx); }
      //   state.isDirty = false;
      // } catch...
      // So it will set to false regardless. So we expect isDirty false.
      expect(state.isDirty).toBe(false);
    });
  });

  describe("saveAllDirty", () => {
    it("should return early if no states for context", async () => {
      await sm.saveAllDirty(ctx);
      // no throw
    });

    it("should save all dirty states with _filePath", async () => {
      const state1 = sm.getOrCreateState("c1", ctx);
      const state2 = sm.getOrCreateState("c2", ctx);
      const save1 = vi.fn().mockResolvedValue(undefined);
      const save2 = vi.fn().mockResolvedValue(undefined);
      (state1 as any).save = save1;
      (state2 as any).save = save2;
      state1._filePath = "/tmp/1.json";
      state2._filePath = "/tmp/2.json";
      state1.isDirty = true;
      state2.isDirty = true;
      await sm.saveAllDirty(ctx);
      expect(save1).toHaveBeenCalled();
      expect(save2).toHaveBeenCalled();
      // both cleaned
      expect(state1.isDirty).toBe(false);
      expect(state2.isDirty).toBe(false);
    });

    it("should skip clean states", async () => {
      const state = sm.getOrCreateState("c", ctx);
      const saveSpy = vi.fn().mockResolvedValue(undefined);
      (state as any).save = saveSpy;
      state._filePath = "/tmp/c.json";
      state.isDirty = false;
      await sm.saveAllDirty(ctx);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe("clearContext", () => {
    it("should save all dirty and clear when states exist", async () => {
      const state = sm.getOrCreateState("c", ctx);
      state._filePath = "/tmp/c.json";
      const saveSpy = vi.fn().mockResolvedValue(undefined);
      (state as any).save = saveSpy;
      state.isDirty = true;
      await sm.clearContext(ctx);
      expect(saveSpy).toHaveBeenCalled();
      expect(sm.getCommandNames(ctx)).toEqual([]);
    });

    it("should do nothing if no states for context", async () => {
      await sm.clearContext(ctx);
      // no throw
    });
  });

  describe("getCommandNames", () => {
    it("should return empty array if no states", () => {
      expect(sm.getCommandNames(ctx)).toEqual([]);
    });

    it("should return all command names", () => {
      sm.getOrCreateState("cmd1", ctx);
      sm.getOrCreateState("cmd2", ctx);
      expect(sm.getCommandNames(ctx).sort()).toEqual(["cmd1", "cmd2"]);
    });
  });

  describe("getStats", () => {
    it("should return zeros when no states", () => {
      expect(sm.getStats(ctx)).toEqual({ commandCount: 0, dirtyCount: 0 });
    });

    it("should count commands and dirty flags correctly", () => {
      const sClean = sm.getOrCreateState("clean", ctx);
      sClean.isDirty = false;
      const sDirty = sm.getOrCreateState("dirty", ctx);
      sDirty.isDirty = true;
      const stats = sm.getStats(ctx);
      expect(stats.commandCount).toBe(2);
      expect(stats.dirtyCount).toBe(1);
    });
  });

  describe("GenericState behavior via getOrCreateState", () => {
    it("should trigger listeners on isDirty true", () => {
      const state = sm.getOrCreateState("cmd", ctx);
      const listener = vi.fn();
      state.subscribe(listener);
      state.isDirty = true;
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should not trigger listeners on isDirty false", () => {
      const state = sm.getOrCreateState("cmd", ctx);
      const listener = vi.fn();
      state.subscribe(listener);
      state.isDirty = false;
      expect(listener).not.toHaveBeenCalled();
    });

    it("getSnapshot should return current isDirty", () => {
      const state = sm.getOrCreateState("cmd", ctx);
      state.isDirty = true;
      expect(state.getSnapshot()).toEqual({ isDirty: true });
      state.isDirty = false;
      expect(state.getSnapshot()).toEqual({ isDirty: false });
    });
  });

  describe("getStateManager singleton", () => {
    it("should return same instance on subsequent calls", () => {
      const a = getStateManager();
      const b = getStateManager();
      expect(a).toBe(b);
    });

    it("should create new instance after reset", () => {
      const a = getStateManager();
      resetStateManager();
      const b = getStateManager();
      expect(a).not.toBe(b);
    });
  });

  describe("resetStateManager", () => {
    it("should clear global singleton", () => {
      const before = getStateManager();
      resetStateManager();
      const after = getStateManager();
      expect(before).not.toBe(after);
    });
  });
});
