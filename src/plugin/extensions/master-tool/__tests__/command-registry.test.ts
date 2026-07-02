import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandRegistry } from "../command-registry.js";
import type { CommandMetadata, CommandModule, CommandLoader } from "../types/command-module.js";

// Mock executor to avoid heavy dependencies
const createMockExecutor = () => ({
  register: vi.fn(),
  listCommands: vi.fn(() => []),
  getMetadata: vi.fn(),
  getSchema: vi.fn(),
  execute: vi.fn(),
  getStats: vi.fn(() => ({ commands: 0 })),
  clearCache: vi.fn(),
});

// Helper to create custom command loader
const createMockLoader = (module?: Partial<CommandModule>): CommandLoader => {
  return vi.fn().mockResolvedValue({
    metadata: { name: "custom", category: "custom", description: "Custom command" } as CommandMetadata,
    schema: {},
    execute: vi.fn(),
    ...module,
  } as CommandModule);
};

describe("CommandRegistry", () => {
  let registry: CommandRegistry;
  let mockExecutor: ReturnType<typeof createMockExecutor>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutor = createMockExecutor();
    // Construct registry with a dummy custom executor? We'll need to inject executor.
    // The CommandRegistry creates its own executor internally. We need to replace it after construction.
    registry = new CommandRegistry({});
    // Replace the internal executor with our mock via property access (not ideal but for testing)
    (registry as any).executor = mockExecutor;
  });

  describe("initialize()", () => {
    it("should be idempotent: second call does not rescan", async () => {
      const spyScan = vi.spyOn(registry as any, "scanCommands").mockResolvedValue(undefined);
      await (registry as any).initialize();
      await (registry as any).initialize(); // second call
      expect(spyScan).toHaveBeenCalledTimes(1);
    });

    it("should register custom commands with minimal metadata", async () => {
      const customLoader = createMockLoader();
      const customCommands = new Map([["mycustom", customLoader as CommandLoader]]);
      registry = new CommandRegistry({}, customCommands);
      (registry as any).executor = mockExecutor;

      // stub scanCommands to succeed immediately
      vi.spyOn(registry as any, "scanCommands").mockResolvedValue(undefined);

      await (registry as any).initialize();

      expect(mockExecutor.register).toHaveBeenCalled();
      const callArg = mockExecutor.register.mock.calls[0][0];
      expect(callArg.metadata.name).toBe("mycustom");
      expect(callArg.metadata.category).toBe("custom");
      expect(callArg.metadata.description).toContain("Custom command (no metadata provided)");
    });

    it("should throw if scanCommands throws", async () => {
      vi.spyOn(registry as any, "scanCommands").mockRejectedValue(new Error("FS error"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect((registry as any).initialize()).rejects.toThrow("FS error");

      expect(consoleErrorSpy).toHaveBeenCalledWith("[CommandRegistry] Failed to initialize:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe("loadCommandMetadata()", () => {
    it("should register a loader with minimal metadata", async () => {
      // Access private method via cast
      const loadCmd = (registry as any).loadCommandMetadata.bind(registry);
      await loadCmd("testcmd", "testcat", "/fake/path.ts");

      expect(mockExecutor.register).toHaveBeenCalled();
      const entry = mockExecutor.register.mock.calls[0][0];
      expect(entry.metadata.name).toBe("testcmd");
      expect(entry.metadata.category).toBe("testcat");
      expect(entry.metadata.description).toBe("Loading...");
      expect(entry.metadata.tags).toContain("testcat");
      expect(entry.loader).toBeDefined();
      // The loader is async; it hasn't been called yet
    });
  });

  describe("getCommandHelp()", () => {
    it("should format help with all fields", () => {
      // Prepare metadata and schema via executor mocks
      const meta: CommandMetadata = {
        name: "mycmd",
        category: "util",
        description: "A test command",
        longDescription: "Detailed info",
        examples: ["example1", "example2"],
        dependsOn: ["dep1"],
        permissions: ["perm1"],
        experimental: true,
      };
      const schema = {
        properties: {
          arg1: { type: "string", description: "First arg" },
          arg2: { type: "number" },
        },
        required: ["arg1"],
      };

      (registry as any).executor.getMetadata = vi.fn().mockReturnValue(meta);
      (registry as any).executor.getSchema = vi.fn().mockReturnValue(schema);

      const help = (registry as any).getCommandHelp("mycmd");

      expect(help).toContain("Command: mycmd");
      expect(help).toContain("Category: util");
      expect(help).toContain("Description: A test command");
      expect(help).toContain("Detailed info");
      expect(help).toContain("Examples:");
      expect(help).toContain("example1");
      expect(help).toContain("Depends on: dep1");
      expect(help).toContain("Permissions: perm1");
      expect(help).toContain("⚠️  EXPERIMENTAL");
      expect(help).toContain("Parameters:");
      expect(help).toContain("arg1: string (required) - First arg");
      expect(help).toContain("arg2: number (optional)");
    });

    it("should not include optional sections if missing", () => {
      const meta: CommandMetadata = {
        name: "simple",
        category: "gen",
        description: "Simple",
      };
      const schema = null;
      (registry as any).executor.getMetadata = vi.fn().mockReturnValue(meta);
      (registry as any).executor.getSchema = vi.fn().mockReturnValue(null);

      const help = (registry as any).getCommandHelp("simple");
      expect(help).not.toContain("Depends on");
      expect(help).not.toContain("Permissions");
      expect(help).not.toContain("EXPERIMENTAL");
      expect(help).not.toContain("Parameters");
    });
  });

  describe("execute()", () => {
    beforeEach(() => {
      // Skip actual initialization
      (registry as any).isInitialized = true;
    });

    it("should return success when no output", async () => {
      const execResult = { code: 0, stdout: "", stderr: "", data: undefined, duration: 0 };
      (registry as any).executor.execute = vi.fn().mockResolvedValue(execResult);
      const execCtx = { toolCallId: "call1", signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 };

      const result = await (registry as any).execute("somecmd", {}, execCtx);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("Success");
      expect(result.isError).toBe(false);
    });

    it("should include stdout and stderr in content", async () => {
      const execResult = { code: 1, stdout: "out", stderr: "err", data: undefined, duration: 10 };
      (registry as any).executor.execute = vi.fn().mockResolvedValue(execResult);
      const execCtx = { toolCallId: "call2", signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 };

      const result = await (registry as any).execute("somecmd", {}, execCtx);

      expect(result.content.map(c => c.text)).toContain("out");
      expect(result.content.map(c => c.text)).toContain("err");
      expect(result.isError).toBe(true);
    });

    it("should handle empty stderr but error code", async () => {
      const execResult = { code: 2, stdout: "", stderr: "", data: undefined, duration: 5 };
      (registry as any).executor.execute = vi.fn().mockResolvedValue(execResult);
      const execCtx = { toolCallId: "call3", signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 };

      const result = await (registry as any).execute("somecmd", {}, execCtx);

      expect(result.content[0].text).toBe("Error occurred");
      expect(result.isError).toBe(true);
    });
  });

  describe("getStats()", () => {
    it("should proxy to executor.getStats()", () => {
      const stats = { commands: 5, cacheSize: 10 };
      (registry as any).executor.getStats = vi.fn().mockReturnValue(stats);
      const result = (registry as any).getStats();
      expect(result).toBe(stats);
      expect((registry as any).executor.getStats).toHaveBeenCalled();
    });
  });

  describe("clearCache()", () => {
    it("should call executor.clearCache()", () => {
      (registry as any).executor.clearCache = vi.fn();
      (registry as any).clearCache();
      expect((registry as any).executor.clearCache).toHaveBeenCalled();
    });
  });

  describe("getExecutor()", () => {
    it("should return the internal executor", () => {
      (registry as any).executor = mockExecutor;
      const result = (registry as any).getExecutor();
      expect(result).toBe(mockExecutor);
    });
  });
});
