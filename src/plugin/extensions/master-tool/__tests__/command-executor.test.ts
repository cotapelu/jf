import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandExecutor } from "../command-executor.js";
import type { CommandModule, CommandRegistryEntry } from "../types/command-module.js";

function createMockCommandModule(overrides: Partial<CommandModule> = {}): CommandModule {
  return {
    metadata: { name: "test", category: "test", description: "Test command" },
    schema: {},
    execute: vi.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "", data: undefined }),
    ...overrides,
  } as any;
}

function createMockEntry(module: CommandModule): CommandRegistryEntry {
  return {
    loader: vi.fn().mockResolvedValue(module),
    metadata: module.metadata,
    schema: module.schema,
    StateClass: module.StateClass,
    getPersistencePath: module.getPersistencePath,
    lastLoaded: Date.now(),
    loadCount: 0,
    errorCount: 0,
    module,
  };
}

describe("CommandExecutor", () => {
  let executor: CommandExecutor;
  let registry: any;
  let validator: any;
  let stateManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new (CommandExecutor as any)({ rateLimitPerMinute: 0, enableAudit: false });
    registry = (executor as any).registry;
    validator = (executor as any).validator;
    stateManager = (executor as any).stateManager;

    // Default validator spies: always pass
    vi.spyOn(validator, "checkRateLimit").mockReturnValue({ allowed: true, resetIn: 0 });
    vi.spyOn(validator, "validateWithSchema").mockReturnValue({ valid: true, errors: undefined });
    vi.spyOn(validator, "validateSecurity").mockReturnValue({ valid: true, errors: [] });
    vi.spyOn(validator, "validateResult").mockReturnValue({ valid: true, errors: [] });
  });

  describe("register", () => {
    it("should register command normally", () => {
      const entry = createMockEntry(createMockCommandModule());
      executor.register(entry);
      expect(registry.has("test")).toBe(true);
    });

    it("should not register if excluded by excludeCommands", () => {
      const exec = new CommandExecutor({ excludeCommands: ["blocked"] });
      (exec as any).register(
        createMockEntry(
          createMockCommandModule({ metadata: { name: "blocked", category: "any", description: "" } })
        )
      );
      expect((exec as any).registry.has("blocked")).toBe(false);
    });

    it("should not register if excluded by excludeCategories", () => {
      const exec = new CommandExecutor({ excludeCategories: ["admin"] });
      (exec as any).register(
        createMockEntry(
          createMockCommandModule({ metadata: { name: "cmd", category: "admin", description: "" } })
        )
      );
      expect((exec as any).registry.has("cmd")).toBe(false);
    });
  });

  describe("unregister", () => {
    it("should delete and return true", () => {
      registry.set("test", {} as any);
      const result = executor.unregister("test");
      expect(result).toBe(true);
      expect(registry.has("test")).toBe(false);
    });

    it("should return false if not present", () => {
      const result = executor.unregister("missing");
      expect(result).toBe(false);
    });
  });

  describe("listCommands", () => {
    it("should return sorted command names", () => {
      registry.set("b", {} as any);
      registry.set("a", {} as any);
      const names = executor.listCommands();
      expect(names).toEqual(["a", "b"]);
    });
  });

  describe("execute", () => {
    const execCtx = {
      toolCallId: "call123",
      signal: undefined,
      onUpdate: undefined,
      ctx: {},
      maxOutputSize: 1000,
    };

    it("should return error CommandResult for unknown command", async () => {
      const result = await (executor as any).execute("unknown", {}, execCtx);
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("Command not found");
    });

    it("should return error result when rate limit exceeded", async () => {
      const entry = createMockEntry(createMockCommandModule());
      registry.set("test", entry);
      (validator as any).checkRateLimit.mockReturnValue({ allowed: false, resetIn: 30 });
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("Rate limit exceeded");
    });

    it("should return error result when schema validation fails", async () => {
      const entry = createMockEntry(createMockCommandModule());
      registry.set("test", entry);
      (validator as any).validateWithSchema.mockReturnValue({ valid: false, errors: [{ path: ["arg"], message: "Missing" }] });
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("Validation failed");
    });

    it("should return error result when security validation fails", async () => {
      const entry = createMockEntry(createMockCommandModule());
      registry.set("test", entry);
      (validator as any).validateSecurity.mockReturnValue({ valid: false, errors: ["Suspicious"] });
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("Security");
    });

    it("should call beforeExecute and afterExecute hooks", async () => {
      const before = vi.fn().mockResolvedValue(undefined);
      const after = vi.fn().mockResolvedValue(undefined);
      const module = createMockCommandModule({
        beforeExecute: before,
        afterExecute: after,
        execute: vi.fn().mockResolvedValue({ code: 0, stdout: "ok", stderr: "", data: undefined }),
      });
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).toBe(0);
      expect(before).toHaveBeenCalledWith({}, expect.any(Object));
      expect(after).toHaveBeenCalled();
    });

    it("should inject state into ctx for hooks and execute when StateClass provided", async () => {
      const fakeState = {
        isDirty: false,
        mutex: undefined,
        markDirty: vi.fn(),
        subscribe: vi.fn().mockReturnValue(() => {}),
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue(true),
        getSnapshot: vi.fn().mockReturnValue({}),
      };
      vi.spyOn(stateManager, "getOrCreateState").mockReturnValue(fakeState);
      vi.spyOn(stateManager, "hasState").mockReturnValue(false);
      vi.spyOn(stateManager, "restoreState").mockResolvedValue(undefined);
      const executeImpl = vi.fn().mockResolvedValue({ code: 0, stdout: "stateful ok", stderr: "", data: undefined });
      const module = createMockCommandModule({
        StateClass: class {},
        getPersistencePath: (ctx: any, name: string) => "/tmp/state.json",
        execute: executeImpl,
        beforeExecute: vi.fn(),
        afterExecute: vi.fn(),
      });
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const result = await (executor as any).execute("test", {}, execCtx);
      if (result.code !== 0) {
        console.log('DEBUG result', JSON.stringify(result, null, 2));
      }
      expect(result.code).toBe(0);
      expect(executeImpl).toHaveBeenCalled();
      const args = executeImpl.mock.calls[0];
      // fourth arg should include injected state
      expect(args[3]).toHaveProperty('commandState');
    });

    it("should catch errors thrown by module.execute and return non-zero code", async () => {
      const module = createMockCommandModule({
        execute: vi.fn().mockRejectedValue(new Error("Boom")),
      });
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("Boom");
    });

    it("should truncate stdout and add warning when output validation fails", async () => {
      const long = "x".repeat(2000);
      const module = createMockCommandModule({
        execute: vi.fn().mockResolvedValue({ code: 0, stdout: long, stderr: "", data: undefined }),
      });
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const execCtxLarge = { ...execCtx, maxOutputSize: 100 };
      // Force output validation to fail so truncation runs
      (validator as any).validateResult.mockReturnValue({ valid: false, errors: [{ message: "Output too large" }] });
      const result = await (executor as any).execute("test", {}, execCtxLarge);
      expect(result.stdout.length).toBeLessThanOrEqual(120);
      expect(result.stdout).toContain("... (truncated)");
      // Warning should be added to stderr
      expect(result.stderr).toContain("Warning");
    });

    it("should truncate stderr and add warning when output validation fails", async () => {
      const long = "e".repeat(2000);
      const module = createMockCommandModule({
        execute: vi.fn().mockResolvedValue({ code: 1, stdout: "", stderr: long, data: undefined }),
      });
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const execCtxLarge = { ...execCtx, maxOutputSize: 100 };
      (validator as any).validateResult.mockReturnValue({ valid: false, errors: [{ message: "Output too large" }] });
      const result = await (executor as any).execute("test", {}, execCtxLarge);
      expect(result.stderr.length).toBeLessThanOrEqual(120);
      expect(result.stderr).toContain("... (truncated)");
    });

    it("should return both stdout and stderr unchanged", async () => {
      const module = createMockCommandModule({
        execute: vi.fn().mockResolvedValue({ code: 0, stdout: "out", stderr: "err", data: undefined }),
      });
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.stdout).toBe("out");
      expect(result.stderr).toBe("err");
    });

    it("should mark entry error and update cache on load failure", async () => {
      const entry = createMockEntry(createMockCommandModule());
      entry.loader = vi.fn().mockRejectedValue(new Error("Load failed"));
      registry.set("test", entry);
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).not.toBe(0);
      expect(entry.errorCount).toBe(1);
      expect(entry.lastError).toBe("Failed to load command 'test': Load failed");
    });

    it("should increment loadCount and update lastLoaded on success", async () => {
      const module = createMockCommandModule();
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).toBe(0);
      expect(entry.loadCount).toBe(1);
      expect(entry.lastLoaded).toBeGreaterThan(0);
    });

    it("should release mutex in finally block when state has mutex", async () => {
      const release = vi.fn();
      const fakeMutex = { lock: vi.fn().mockResolvedValue(release) };
      const fakeState = {
        isDirty: false,
        mutex: fakeMutex,
        markDirty: vi.fn(),
        subscribe: vi.fn().mockReturnValue(() => {}),
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue(true),
        getSnapshot: vi.fn().mockReturnValue({}),
      };
      vi.spyOn(stateManager, "getOrCreateState").mockReturnValue(fakeState);
      vi.spyOn(stateManager, "hasState").mockReturnValue(false);
      vi.spyOn(stateManager, "restoreState").mockResolvedValue(undefined);
      const module = createMockCommandModule({
        StateClass: class {},
        getPersistencePath: (ctx: any, name: string) => "",
        execute: vi.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "", data: undefined }),
      });
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const result = await (executor as any).execute("test", {}, execCtx);
      expect(result.code).toBe(0);
      expect(release).toHaveBeenCalled();
    });
  });

  describe("loadModule", () => {
    it("should return from cache if present", async () => {
      const module = createMockCommandModule();
      const cache = (executor as any).cache;
      cache.set("test", module, module.metadata);
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const loaded = await (executor as any).loadModule("test", entry);
      expect(loaded).toBe(module);
      expect(entry.loader).not.toHaveBeenCalled();
    });

    it("should load via loader and cache if not cached", async () => {
      const module = createMockCommandModule();
      const entry = createMockEntry(module);
      registry.set("test", entry);
      const loaded = await (executor as any).loadModule("test", entry);
      expect(loaded).toBe(module);
      expect(entry.loader).toHaveBeenCalled();
      expect((executor as any).cache.get("test")).toBe(module);
    });

    it("should set entry.module after successful load", async () => {
      const module = createMockCommandModule();
      const entry = createMockEntry(module);
      registry.set("test", entry);
      await (executor as any).loadModule("test", entry);
      expect(entry.module).toBe(module);
    });
  });
});
