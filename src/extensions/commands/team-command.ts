#!/usr/bin/env node

/**
 * Team Widget Toggle Command
 *
 * Toggle the team status widget visibility.
 * Usage: /team (toggle on/off)
 */

import { toggleTeamWidget, getTeamWidgetEnabled } from "../team/team-widget.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerTeamCommand(api: ExtensionAPI): void {
  api.registerCommand("team", {
    description: "Toggle team status widget (show/hide)",
    handler: async (_args: string, ctx: any) => {
      const before = getTeamWidgetEnabled(ctx);
      const after = toggleTeamWidget(ctx);
      const status = after ? "shown" : "hidden";
      ctx.ui.notify(`Team widget ${status}`, "info");
    },
  });
}
