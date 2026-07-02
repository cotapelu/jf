import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { registerTeamCommand } from "../../extensions/commands/team-command.js";
import * as teamWidget from "../../extensions/team/team-widget.js";

describe("Team Command Integration", () => {
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

  it("registers the /team command", () => {
    registerTeamCommand(mockApi);
    expect(mockApi.registerCommand).toHaveBeenCalledWith(
      "team",
      expect.objectContaining({
        description: "Toggle team status widget (show/hide)",
        handler: expect.any(Function),
      })
    );
  });

  it("toggles widget from hidden to shown and notifies", async () => {
    const getSpy = vi.spyOn(teamWidget, "getTeamWidgetEnabled").mockReturnValue(false);
    const toggleSpy = vi.spyOn(teamWidget, "toggleTeamWidget").mockReturnValue(true);

    registerTeamCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = { ui: { notify: mockNotify } };

    await handler("", ctx);

    expect(getSpy).toHaveBeenCalled();
    expect(toggleSpy).toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith("Team widget shown", "info");
  });

  it("toggles widget from shown to hidden and notifies", async () => {
    const getSpy = vi.spyOn(teamWidget, "getTeamWidgetEnabled").mockReturnValue(true);
    const toggleSpy = vi.spyOn(teamWidget, "toggleTeamWidget").mockReturnValue(false);

    registerTeamCommand(mockApi);
    const handler: any = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = { ui: { notify: mockNotify } };

    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("Team widget hidden", "info");
  });
});
