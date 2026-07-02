import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateManager } from "../state-manager.js";

// Mock state implementing CommandState interface
class MockState implements CommandState {
  isDirty = false;
  mutex?: any;
  listeners?: Set<() => void>;
  _filePath?: string;
  markDirty = vi.fn(() => { this.isDirty = true; });
  subscribe = vi.fn().mockReturnValue(() => {});
  save = vi.fn().mockResolvedValue(undefined);
  load = vi.fn().mockResolvedValue(true);
  getSnapshot = vi.fn().mockReturnValue({});
}

describe("StateManager", () => {
  let sm: StateManager;
  let ctx: any;

  beforeEach(() => {
    sm = new StateManager();
    ctx = {}; // mock ExtensionContext
  });

  describe("getOrCreateState", () => {
    it("should create new state using StateClass", () => {
      const state = sm.getOrCreateState("cmd", ctx, MockState);
      expect(state).toBeInstanceOf(MockState);
      expect(state.isDirty).toBe(false);
    });

    it("should return same state on subsequent calls", () => {
      const state1 = sm.getOrCreateState("cmd", ctx, MockState);
      const state2 = sm.getOrCreateState("cmd", ctx, MockState);
      expect(state1).toBe(state2);
    });

    it("should set _filePath when persistencePath provided", () => {
      const state = sm.getOrCreateState("cmd", ctx, MockState, (c, name) => `/tmp/${name}.json`);
      expect(state._filePath).toBe("/tmp/cmd.json");
    });

    it("should create generic state when no StateClass", () => {
      const state = sm.getOrCreateState("cmd", ctx);
      expect(state).toBeDefined();
      expect(typeof state.markDirty).toBe("function");
      expect(typeof state.save).toBe("function");
    });
  });

  describe("hasState", () => {
    it("should return false when no state", () => {
      expect(sm.hasState("cmd", ctx)).toBe(false);
    });
    it("should return true after state created", () => {
      sm.getOrCreateState("cmd", ctx, MockState);
      expect(sm.hasState("cmd", ctx)).toBe(true);
    });
  });

  describe("getState", () => {
    it("should return state if exists", () => {
      sm.getOrCreateState("cmd", ctx, MockState);
      expect(sm.getState("cmd", ctx)).toBeDefined();
    });
    it("should return undefined if not exists", () => {
      expect(sm.getState("cmd", ctx)).toBeUndefined();
    });
  });

  describe("restoreState", () => {
    it("should return false if no _filePath", async () => {
      const result = await sm.restoreState("cmd", ctx, MockState);
      expect(result).toBe(false);
    });

    it("should return true and set isDirty false when load succeeds", async () => {
      const mockLoad = vi.fn().mockResolvedValue(true);
      const state = new MockState();
      state._filePath = "/tmp/cmd.json";
      state.load = mockLoad;
      // Manually inject state
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      const result = await sm.restoreState("cmd", ctx);
      expect(result).toBe(true);
      expect(state.isDirty).toBe(false);
      expect(mockLoad).toHaveBeenCalled();
    });

    it("should return false when load returns false", async () => {
      const state = new MockState();
      state._filePath = "/tmp/cmd.json";
      state.load = vi.fn().mockResolvedValue(false);
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      const result = await sm.restoreState("cmd", ctx);
      expect(result).toBe(false);
    });

    it("should return false and log when load throws", async () => {
      const state = new MockState();
      state._filePath = "/tmp/cmd.json";
      state.load = vi.fn().mockRejectedValue(new Error("IO error"));
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await sm.restoreState("cmd", ctx);
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to load state"), expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe("saveStateIfDirty", () => {
    it("should not save if not dirty", async () => {
      const state = new MockState();
      state.isDirty = false;
      state._filePath = "/tmp/cmd.json";
      state.save = vi.fn();
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      await sm.saveStateIfDirty("cmd", ctx);
      expect(state.save).not.toHaveBeenCalled();
    });

    it("should call save if dirty and _filePath exists, then clear dirty", async () => {
      const state = new MockState();
      state.isDirty = true;
      state._filePath = "/tmp/cmd.json";
      const saveMock = vi.fn().mockResolvedValue(undefined);
      state.save = saveMock;
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      await sm.saveStateIfDirty("cmd", ctx);
      expect(saveMock).toHaveBeenCalled();
      expect(state.isDirty).toBe(false);
    });

    it("should clear dirty even if _filePath not set", async () => {
      const state = new MockState();
      state.isDirty = true;
      state._filePath = undefined;
      state.save = vi.fn();
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      await sm.saveStateIfDirty("cmd", ctx);
      expect(state.save).not.toHaveBeenCalled();
      expect(state.isDirty).toBe(false);
    });

    it("should log error but not clear dirty if save throws", async () => {
      const state = new MockState();
      state.isDirty = true;
      state._filePath = "/tmp/cmd.json";
      state.save = vi.fn().mockRejectedValue(new Error("disk full"));
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await sm.saveStateIfDirty("cmd", ctx);
      expect(state.save).toHaveBeenCalled();
      // isDirty remains true because after error it is not reset
      expect(state.isDirty).toBe(true);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("markDirty", () => {
    it("should call state.markDirty", () => {
      const state = new MockState();
      (sm as any).states.set(ctx, new Map([["cmd", state]]));
      sm.markDirty("cmd", ctx);
      expect(state.markDirty).toHaveBeenCalled();
    });
  });

  describe("saveAllDirty", () => {
    it("should save all dirty states", async () => {
      const state1 = new MockState();
      state1.isDirty = true;
      state1._filePath = "/tmp/1.json";
      state1.save = vi.fn().mockResolvedValue(undefined);
      const state2 = new MockState();
      state2.isDirty = true;
      state2._filePath = "/tmp/2.json";
      state2.save = vi.fn().mockResolvedValue(undefined);
      (sm as any).states.set(ctx, new Map([["c1", state1], ["c2", state2]]));
      await sm.saveAllDirty(ctx);
      expect(state1.save).toHaveBeenCalled();
      expect(state2.save).toHaveBeenCalled();
      expect(state1.isDirty).toBe(false);
      expect(state2.isDirty).toBe(false);
    });
  });

  describe("generic state (no StateClass)", () => {
    it("should have working listeners and dirty flag", () => {
      const state = sm.getOrCreateState("cmd", ctx);
      const listener = vi.fn();
      state.subscribe(listener);
      state.markDirty();
      expect(state.isDirty).toBe(true);
      expect(listener).toHaveBeenCalled();
      // Unsubscribe
      const off = state.subscribe(listener);
      off();
      state.markDirty();
      expect(listener).not.toHaveBeenCalledTimes(2);
    });

    it("should have default load returning false", async () => {
      const state = sm.getOrCreateState("cmd", ctx);
      const loaded = await state.load(ctx);
      expect(loaded).toBe(false);
    });

    it("should have default save that resolves", async () => {
      const state = sm.getOrCreateState("cmd", ctx);
      await expect(state.save(ctx)).resolves.toBeUndefined();
    });
  });
});
