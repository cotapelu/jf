import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock team widget module
vi.mock("../extensions/team/team-widget.js", () => ({
  getTeamWidgetEnabled: vi.fn(),
  toggleTeamWidget: vi.fn(),
  registerTeamWidget: vi.fn(),
}));

import { registerTeamCommand } from "../extensions/commands/team-command.js";
import { getTeamWidgetEnabled, toggleTeamWidget } from "../extensions/team/team-widget.js";

describe("Team Command", () => {
  let mockNotify: any;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify = vi.fn();
    mockApi = { registerCommand: vi.fn() };
    registerTeamCommand(mockApi);
  });

  it("registers the /team command", () => {
    expect(mockApi.registerCommand).toHaveBeenCalledWith(
      "team",
      expect.objectContaining({
        description: expect.stringContaining("Toggle team status widget"),
        handler: expect.any(Function),
      })
    );
  });

  it("handler toggles widget and notifies hidden status", async () => {
    vi.mocked(getTeamWidgetEnabled).mockReturnValue(true);
    vi.mocked(toggleTeamWidget).mockReturnValue(false);

    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = { ui: { notify: mockNotify } };

    await handler("", ctx);

    expect(toggleTeamWidget).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith("Team widget hidden", "info");
  });

  it("handler notifies shown status when toggled on", async () => {
    vi.mocked(getTeamWidgetEnabled).mockReturnValue(false);
    vi.mocked(toggleTeamWidget).mockReturnValue(true);

    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = { ui: { notify: mockNotify } };

    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("Team widget shown", "info");
  });
});
