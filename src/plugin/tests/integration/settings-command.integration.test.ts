import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { registerSettingsCommand } from "../../extensions/commands/settings-command.js";

describe("Settings Command Integration", () => {
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

  it("registers /settings command", () => {
    registerSettingsCommand(mockApi);
    expect(mockApi.registerCommand).toHaveBeenCalledWith(
      "settings",
      expect.objectContaining({
        description: "Configure Piclaw settings (model, thinking)",
        handler: expect.any(Function),
      })
    );
  });

  it("requires TUI mode and notifies if not", async () => {
    const ctx = {
      mode: "api",
      ui: {
        notify: mockNotify,
        custom: vi.fn(),
      },
    };

    registerSettingsCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("/settings requires TUI mode", "error");
  });
});
