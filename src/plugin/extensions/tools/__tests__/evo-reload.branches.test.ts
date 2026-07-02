#!/usr/bin/env node
/**
 * Branch coverage for evo-reload tool
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { registerEvoReloadTool } from "../evo-reload.js";
import type { ExtensionAPI, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

let capturedTool: any = null;
let mockApi: ExtensionAPI;

function createMockAPI() {
  return {
    on: vi.fn(),
    registerTool: (tool: any) => { capturedTool = tool; },
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
      getActiveSession: vi.fn().mockReturnValue(null),
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

describe('Evo Reload Tool (Branch Coverage)', () => {
  beforeEach(() => {
    capturedTool = null;
    mockApi = createMockAPI();
    registerEvoReloadTool(mockApi);
  });

  function executeTool(params: Record<string, any> = {}): Promise<AgentToolResult<any>> {
    if (!capturedTool) throw new Error("Tool not registered");
    const ctx = createMockContext();
    return capturedTool.execute('test-id', params, null, null, ctx);
  }

  describe('execute() error handling', () => {
    it('handles sendUserMessage throwing an Error', async () => {
      vi.mocked(mockApi.sendUserMessage).mockImplementation(() => { throw new Error('reject failure'); });
      const result = await executeTool();
      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('reject failure');
      expect(result.details?.stack).toBeDefined();
    });

    it('handles sendUserMessage throwing a non-Error object', async () => {
      vi.mocked(mockApi.sendUserMessage).mockImplementation(() => { throw { code: 'ERR' }; });
      const result = await executeTool();
      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('[object Object]'); // String(error) yields "[object Object]"
    });

    it('executes successfully when sendUserMessage succeeds', async () => {
      vi.mocked(mockApi.sendUserMessage).mockResolvedValue(undefined);
      const result = await executeTool();
      expect(result.isError).toBe(false);
      expect(result.details?.action).toBe('reload_queued');
      expect(result.details?.timestamp).toBeDefined();
      expect(result.content[0].text).toContain('queued');
    });
  });

  describe('renderResult() branches', () => {
    it('renders success for reloaded action', () => {
      const result: AgentToolResult<any> = {
        content: [{ type: "text", text: "OK" }],
        details: { action: "reloaded" },
        isError: false
      };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);
      const lines = rendered.render(80);
      const text = lines.join('');
      expect(text).toContain('✅');
      expect(text).toContain('Runtime reloaded');
    });

    it('renders fallback for unknown action', () => {
      const result: AgentToolResult<any> = {
        content: [{ type: "text", text: "OK" }],
        details: { action: "unknown" },
        isError: false
      };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);
      const lines = rendered.render(80);
      const text = lines.join('');
      expect(text).toContain('Reload complete');
    });

    it('renders fallback when details missing error message in isError', () => {
      const result: AgentToolResult<any> = {
        content: [{ type: "text", text: "err" }],
        details: { error: undefined },
        isError: true
      };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);
      const lines = rendered.render(80);
      const text = lines.join('');
      expect(text).toContain('❌');
      // Should show default unknown error text
      expect(text).toContain('Unknown error');
    });

    it('renders error with specific error message', () => {
      const result: AgentToolResult<any> = {
        content: [{ type: "text", text: "err" }],
        details: { error: 'Network failure' },
        isError: true
      };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);
      const lines = rendered.render(80);
      const text = lines.join('');
      expect(text).toContain('❌');
      expect(text).toContain('Network failure');
    });

    it('renders partial state indicator when isPartial true', () => {
      const result: AgentToolResult<any> = {
        content: [{ type: "text", text: "OK" }],
        details: {},
        isError: false
      };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: true }, { fg: (c: string, s: string) => s } as any);
      const lines = rendered.render(80);
      const text = lines.join('');
      expect(text).toContain('⏳');
      expect(text).toContain('Reloading runtime');
    });
  });
});
