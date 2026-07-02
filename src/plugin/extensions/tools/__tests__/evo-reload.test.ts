#!/usr/bin/env node
/**
 * Evo Reload Tool Tests
 *
 * Tool queues the system /reload command by sending a user message.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerEvoReloadTool } from "../evo-reload.js";
import type { ExtensionAPI, ToolDefinition, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// Captured tool
let capturedTool: ToolDefinition | null = null;
let mockApi: ExtensionAPI;

function createMockAPI() {
  return {
    on: vi.fn(),
    registerTool: (tool: ToolDefinition) => { capturedTool = tool; },
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
    registerMessageRenderer: vi.fn(),
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
    appendEntry: vi.fn(),
    setSessionName: vi.fn(),
    getSessionName: vi.fn(),
    setLabel: vi.fn(),
    exec: vi.fn(),
    getActiveTools: vi.fn().mockReturnValue([]),
    getAllTools: vi.fn().mockReturnValue([]),
    setActiveTools: vi.fn(),
    getCommands: vi.fn().mockReturnValue([]),
    setModel: vi.fn(),
    getThinkingLevel: vi.fn().mockReturnValue(1),
    setThinkingLevel: vi.fn(),
    registerProvider: vi.fn(),
  } as unknown as ExtensionAPI;
}

function createMockContext() {
  return {
    sessionManager: {
      getActiveSession: vi.fn().mockReturnValue(null), // not used
    } as any,
    cwd: process.cwd(),
    exec: vi.fn(),
    signal: undefined,
    isIdle: vi.fn().mockReturnValue(true),
    isProjectTrusted: vi.fn().mockReturnValue(true),
    ui: { notify: vi.fn() },
    mode: 'tui' as const,
    hasUI: true,
  };
}

describe("Evo Reload Tool (slash command queuer)", () => {
  beforeEach(() => {
    capturedTool = null;
    mockApi = createMockAPI();
    registerEvoReloadTool(mockApi);
  });

  function executeTool(params: Record<string, any> = {}): AgentToolResult<any> {
    if (!capturedTool) throw new Error("Tool not registered");
    const ctx = createMockContext();
    return capturedTool.execute('test-id', params, null, null, ctx);
  }

  describe("Tool Definition", () => {
    it("should have correct name", () => {
      expect(capturedTool!.name).toBe("evo-reload");
    });

    it("should have descriptive label", () => {
      expect(capturedTool!.label).toBe("Reload Runtime");
    });

    it("should have clear description", () => {
      expect(capturedTool!.description).toContain("Reload the entire runtime");
      expect(capturedTool!.description).toContain("extensions, skills, prompts, themes");
    });

    it("should have empty parameters", () => {
      expect(capturedTool!.parameters).toEqual({ type: "object", properties: {} });
    });

    it("should have guidelines", () => {
      expect(capturedTool!.promptGuidelines.length).toBeGreaterThan(0);
    });

    it("should have prompt snippet", () => {
      expect(capturedTool!.promptSnippet).toContain("evo-reload()");
      expect(capturedTool!.promptSnippet).toContain("No parameters required");
    });
  });

  describe("execute()", () => {
    it("should queue /reload command via sendUserMessage", async () => {
      const result = await executeTool();

      expect(result.isError).toBe(false);
      expect(result.details?.action).toBe("reload_queued");
      expect(mockApi.sendUserMessage).toHaveBeenCalledTimes(1);
      expect(mockApi.sendUserMessage).toHaveBeenCalledWith("/reload", { deliverAs: "followUp" });
    });

    it("should ignore extra parameters", async () => {
      await executeTool({ extra: "param" });

      expect(mockApi.sendUserMessage).toHaveBeenCalledTimes(1);
      expect(mockApi.sendUserMessage).toHaveBeenCalledWith("/reload", { deliverAs: "followUp" });
    });

    it("returns success message", async () => {
      const result = await executeTool();

      expect(result.content[0].text).toContain("Runtime reload queued");
    });

    it("does not depend on sessionManager", async () => {
      // Even if sessionManager is missing or null, tool should still queue command
      const ctx = createMockContext();
      ctx.sessionManager = null as any;
      if (!capturedTool) throw new Error("Tool not registered");
      const result = await capturedTool.execute('test-id', {}, null, null, ctx);

      expect(result.isError).toBe(false);
      expect(mockApi.sendUserMessage).toHaveBeenCalledWith("/reload", { deliverAs: "followUp" });
    });
  });

  describe("renderResult()", () => {
    it("shows queued success message", () => {
      if (!capturedTool) throw new Error("Tool not registered");
      const result: AgentToolResult<any> = {
        content: [{ type: "text", text: "OK" }],
        details: { action: "reload_queued" },
        isError: false
      };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);
      console.log('rendered:', rendered);
      expect(rendered).toBeInstanceOf(Text);
      const lines = rendered.render(80);
      console.log('lines:', lines);
      const joined = lines.join('');
      expect(joined).toContain('✅');
      expect(joined).toContain('queued');
    });

    it("shows partial message", () => {
      if (!capturedTool) throw new Error("Tool not registered");
      const result: AgentToolResult<any> = { content: [], details: {}, isError: false };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: true }, { fg: (c: string, s: string) => s } as any);
      const lines = rendered.render(80);
      const joined = lines.join('');
      expect(joined).toContain('⏳');
    });

    it("shows error message", () => {
      if (!capturedTool) throw new Error("Tool not registered");
      const result: AgentToolResult<any> = {
        content: [{ type: "text", text: "err" }],
        details: { error: "Boom" },
        isError: true
      };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);
      const lines = rendered.render(80);
      const joined = lines.join('');
      expect(joined).toContain('❌');
      expect(joined).toContain('Boom');
    });
  });
});
