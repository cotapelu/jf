import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { registerSessionTreeCommand } from "../../extensions/commands/session-tree-command.js";

describe("Session Tree Command Integration", () => {
  let mockApi: any;
  let mockNotify: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify = vi.fn();
    mockApi = {
      registerCommand: vi.fn(),
      on: vi.fn(),
    };
  });

  it("registers /tree command", () => {
    registerSessionTreeCommand(mockApi);
    expect(mockApi.registerCommand).toHaveBeenCalledWith(
      "tree",
      expect.objectContaining({
        description: "Show session tree browser - navigate branches and view entries",
        handler: expect.any(Function),
      })
    );
  });

  it("requires session manager and notifies if missing", async () => {
    const ctx = {
      sessionManager: null,
      mode: "tui",
      ui: { notify: mockNotify, custom: vi.fn() },
    };

    registerSessionTreeCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("Session manager not available", "error");
  });

  it("requires TUI mode and notifies if not", async () => {
    const mockSessionManager = { getTree: () => [], getLeafId: () => null };
    const ctx = {
      sessionManager: mockSessionManager,
      mode: "api",
      ui: { notify: mockNotify, custom: vi.fn() },
    };

    registerSessionTreeCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("/tree requires TUI mode", "error");
  });

  it("opens tree UI in TUI mode with session manager", async () => {
    const mockSessionManager = {
      getTree: () => [
        { id: "1", parentId: null, type: "message", timestamp: Date.now(), entry: { type: "message", message: { role: "user", content: [] } } },
      ],
      getLeafId: () => "1",
    };
    const mockCustom = vi.fn();
    const ctx = {
      sessionManager: mockSessionManager,
      mode: "tui",
      hasUI: true,
      ui: { notify: mockNotify, custom: mockCustom },
    };

    registerSessionTreeCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    // Should call ctx.ui.custom with a render function (second arg options exist but shape may vary)
    expect(mockCustom).toHaveBeenCalledTimes(1);
    expect(typeof mockCustom.mock.calls[0][0]).toBe("function");
  });
});
