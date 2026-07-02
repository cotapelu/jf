import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the pi-coding-agent module before importing copy-command
vi.mock("@earendil-works/pi-coding-agent", () => {
  const copyMock = vi.fn();
  return {
    copyToClipboard: copyMock,
    // Provide minimal exports to satisfy imports (copy-command only uses types from this module)
  };
});

import { registerCopyCommand } from "../../extensions/commands/copy-command.js";
import * as pi from "@earendil-works/pi-coding-agent";

// Grab the mocked copyToClipboard for assertions
const copyToClipboard = vi.mocked(pi.copyToClipboard);

describe("Copy Command Integration", () => {
  let mockApi: any;
  let mockNotify: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify = vi.fn();
    mockApi = { registerCommand: vi.fn() };
    // Reset copy mock
    copyToClipboard.mockReset().mockResolvedValue(undefined);
  });

  it("registers /copy command", () => {
    registerCopyCommand(mockApi);
    expect(mockApi.registerCommand).toHaveBeenCalledWith(
      "copy",
      expect.objectContaining({
        description: "Copy last assistant response to clipboard",
        handler: expect.any(Function),
      })
    );
  });

  it("copies last assistant message text", async () => {
    const mockSessionManager = {
      getTree: () => [
        { entry: { type: "message", message: { role: "user", content: [{ type: "text", text: "Hello" }] } } },
        { entry: { type: "message", message: { role: "assistant", content: [{ type: "text", text: "Hi there!" }] } } },
      ],
    };
    const ctx = { sessionManager: mockSessionManager, ui: { notify: mockNotify } };

    registerCopyCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(copyToClipboard).toHaveBeenCalledWith("Hi there!");
    expect(mockNotify).toHaveBeenCalledWith("Copied last assistant response to clipboard", "info");
  });

  it("handles empty tree", async () => {
    const mockSessionManager = { getTree: () => [] };
    const ctx = { sessionManager: mockSessionManager, ui: { notify: mockNotify } };

    registerCopyCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("No session history", "error");
  });

  it("handles missing session manager", async () => {
    const ctx = { sessionManager: null, ui: { notify: mockNotify } };

    registerCopyCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("Session manager not available", "error");
  });

  it("handles when no assistant message found", async () => {
    const mockSessionManager = {
      getTree: () => [
        { entry: { type: "message", message: { role: "user", content: [{ type: "text", text: "Only user" }] } } },
      ],
    };
    const ctx = { sessionManager: mockSessionManager, ui: { notify: mockNotify } };

    registerCopyCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("No assistant response found", "error");
  });

  it("handles clipboard copy error", async () => {
    copyToClipboard.mockRejectedValue(new Error("clipboard error"));
    const mockSessionManager = {
      getTree: () => [
        { entry: { type: "message", message: { role: "assistant", content: [{ type: "text", text: "Test" }] } } },
      ],
    };
    const ctx = { sessionManager: mockSessionManager, ui: { notify: mockNotify } };

    registerCopyCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("Failed to copy: clipboard error", "error");
  });

  it("skips assistant messages with empty/whitespace text", async () => {
    const mockSessionManager = {
      getTree: () => [
        { entry: { type: "message", message: { role: "assistant", content: [{ type: "text", text: "" }] } } },
        { entry: { type: "message", message: { role: "assistant", content: [{ type: "text", text: "   " }] } } },
        { entry: { type: "message", message: { role: "assistant", content: [{ type: "text", text: "Valid response" }] } } },
      ],
    };
    const ctx = { sessionManager: mockSessionManager, ui: { notify: mockNotify } };

    registerCopyCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(copyToClipboard).toHaveBeenCalledWith("Valid response");
    expect(mockNotify).toHaveBeenCalledWith("Copied last assistant response to clipboard", "info");
  });
});
