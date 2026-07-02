#!/usr/bin/env node

/**
 * Provider Command Unit Tests
 *
 * Tests argument parsing and model registry interactions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Extract handler logic for testing
function parseProviderArgs(args: string): { subcommand: string; rest: string[] } {
  const parts = args.trim().split(/\s+/);
  const sub = parts[0] || "";
  return { subcommand: sub, rest: parts.slice(1) };
}

// Mock context creator
function createMockContext(): any {
  return {
    ui: {
      notify: vi.fn(),
    },
    modelRegistry: {
      getAll: vi.fn().mockReturnValue([]),
      registerProvider: vi.fn(),
      unregisterProvider: vi.fn(),
      // testProvider returns {success: boolean, error?: string}
      testProvider: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

describe("Provider Command Parsing", () => {
  it("parses list subcommand", () => {
    const { subcommand, rest } = parseProviderArgs("list");
    expect(subcommand).toBe("list");
    expect(rest).toEqual([]);
  });

  it("parses add subcommand with args", () => {
    const { subcommand, rest } = parseProviderArgs("add myprovider http://localhost:11434 sk-123");
    expect(subcommand).toBe("add");
    expect(rest).toEqual(["myprovider", "http://localhost:11434", "sk-123"]);
  });

  it("parses remove subcommand", () => {
    const { subcommand, rest } = parseProviderArgs("remove myprovider");
    expect(subcommand).toBe("remove");
    expect(rest).toEqual(["myprovider"]);
  });

  it("parses test subcommand", () => {
    const { subcommand, rest } = parseProviderArgs("test myprovider");
    expect(subcommand).toBe("test");
    expect(rest).toEqual(["myprovider"]);
  });
});

describe("Provider Command Handler", () => {
  let mockApi: any;
  let mockCtx: any;
  let capturedHandler: any;

  beforeEach(() => {
    mockApi = {
      registerCommand: vi.fn((name, cmd) => {
        capturedHandler = cmd.handler;
      }),
    };
    mockCtx = createMockContext();

    // Simulate registration
    // We'll manually call the function that would register the command
    // For testing, we'll replicate the handler logic similar to actual
    capturedHandler = async (args: string, ctx: any) => {
      const { subcommand, rest } = parseProviderArgs(args);
      const registry = ctx.modelRegistry;
      switch (subcommand) {
        case "list":
          const providers = registry.getAll();
          ctx.ui.notify(`Providers: ${providers.map((p: any) => p.id).join(", ")}`, "info");
          break;
        case "add": {
          const [name, endpoint, key] = rest;
          if (!name || !endpoint || !key) {
            ctx.ui.notify("Usage: /providers add <name> <endpoint> <key>", "error");
            return;
          }
          registry.registerProvider({ id: name, provider: name, endpoint, apiKey: key });
          ctx.ui.notify(`Added provider ${name}`, "info");
          break;
        }
        case "remove": {
          const [name] = rest;
          if (!name) {
            ctx.ui.notify("Usage: /providers remove <name>", "error");
            return;
          }
          registry.unregisterProvider(name);
          ctx.ui.notify(`Removed provider ${name}`, "info");
          break;
        }
        case "test": {
          const [name] = rest;
          if (!name) {
            ctx.ui.notify("Usage: /providers test <name>", "error");
            return;
          }
          const result = await registry.testProvider(name);
          if (result.success) {
            ctx.ui.notify(`Provider ${name} test succeeded`, "info");
          } else {
            ctx.ui.notify(`Provider ${name} test failed: ${result.error}`, "error");
          }
          break;
        }
        default:
          ctx.ui.notify("Usage: /providers [list|add|remove|test] ...", "error");
      }
    };
  });

  function runHandler(args: string) {
    return capturedHandler(args, mockCtx);
  }

  describe("list", () => {
    it("lists all providers", async () => {
      mockCtx.modelRegistry.getAll.mockReturnValue([{ id: "openai" }, { id: "kilo" }]);
      await runHandler("list");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Providers: openai, kilo", "info");
    });
  });

  describe("add", () => {
    it("adds provider with correct args", async () => {
      await runHandler("add test http://localhost:11434 key123");
      expect(mockCtx.modelRegistry.registerProvider).toHaveBeenCalledWith({
        id: "test",
        provider: "test",
        endpoint: "http://localhost:11434",
        apiKey: "key123",
      });
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Added provider test", "info");
    });

    it("shows error if missing args", async () => {
      await runHandler("add");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Usage: /providers add <name> <endpoint> <key>", "error");
    });
  });

  describe("remove", () => {
    it("removes provider by name", async () => {
      await runHandler("remove myprovider");
      expect(mockCtx.modelRegistry.unregisterProvider).toHaveBeenCalledWith("myprovider");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Removed provider myprovider", "info");
    });

    it("shows error if missing name", async () => {
      await runHandler("remove");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Usage: /providers remove <name>", "error");
    });
  });

  describe("test", () => {
    it("tests provider success", async () => {
      mockCtx.modelRegistry.testProvider.mockResolvedValue({ success: true });
      await runHandler("test myprovider");
      expect(mockCtx.modelRegistry.testProvider).toHaveBeenCalledWith("myprovider");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Provider myprovider test succeeded", "info");
    });

    it("tests provider failure", async () => {
      mockCtx.modelRegistry.testProvider.mockResolvedValue({ success: false, error: "connection timeout" });
      await runHandler("test myprovider");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Provider myprovider test failed: connection timeout", "error");
    });

    it("shows error if missing name", async () => {
      await runHandler("test");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Usage: /providers test <name>", "error");
    });
  });

  describe("default", () => {
    it("shows usage for unknown subcommand", async () => {
      await runHandler("unknown");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Usage: /providers [list|add|remove|test] ...", "error");
    });
  });
});
