#!/usr/bin/env node
/**
 * Evo Reload Tool
 *
 * Tool for LLM to trigger runtime reload after making code changes.
 * Reloads extensions, skills, prompts, and themes without restarting.
 *
 * Usage: evo.reload()
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

/**
 * Register evo.reload tool.
 */
export function registerEvoReloadTool(api: ExtensionAPI): void {
  // Register the /reload command handler
  api.registerCommand("reload", {
    description: "Reload extensions, skills, prompts, and themes",
    handler: async (_args: any, ctx: any) => {
      await ctx.reload();
    },
  });

  const tool: ToolDefinition = {
    name: "evo-reload",
    label: "Reload Runtime",
    description: "Reload the entire runtime (extensions, skills, prompts, themes) without restarting. Use after modifying code to apply changes instantly. This queues the built-in /reload slash command.",
    promptSnippet: `
# Reload runtime after code changes

Call: evo-reload()

# Important:
# - No parameters required
# - Queues system /reload command
# - Use before testing modified extensions
`, 
    promptGuidelines: [
      "**Purpose**: Apply code changes without manual restart. Essential for autonomous development workflows.",
      "",
      "**When to use**:",
      "- You have modified extension code in src/extensions/",
      "- You have edited skill files (.skill files)",
      "- You have updated custom prompts or themes",
      "- You want to test changes immediately after applying them",
      "",
      "**How it works**:",
      "- Queues a /reload slash command as follow-up user message",
      "- System processes the command and refreshes runtime",
      "- All extensions reinitialize, skills reload, prompts/themes refresh",
      "",
      "**After reloading**:",
      "- You can continue the conversation normally",
      "- New code is now active",
      "- Use codebase plugin tools to verify changes",
      "",
      "**Note**: No parameters required. Simply call evo.reload() with empty object.",
      "",
      "**Example**:",
      "User: 'I have updated the git status command to show more details'",
      "Agent: 'Let me reload to pick up the changes.' → evo.reload()",
      "Agent: 'Now testing git.status...'",
    ],
    parameters: Type.Object({}), // Empty parameters

    async execute(toolCallId: string, params: Record<string, any>, signal: AbortSignal | null | undefined, onUpdate: ((data: any) => void) | null | undefined, ctx: any): Promise<any> {
      try {
        // Tools receive ExtensionContext which does not have reload().
        // Queue the /reload command as a follow-up user message.
        api.sendUserMessage("/reload", { deliverAs: "followUp" });

        return {
          content: [{ type: "text", text: "✅ Runtime reload queued. The system will reload shortly." }],
          details: { action: "reload_queued", timestamp: Date.now() },
          isError: false
        };
      } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `❌ Failed to queue reload: ${message}` }],
          details: { error: message, stack: error.stack },
          isError: true
        };
      }
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any): any {
      const isError = result.isError;
      const details = result.details || {};

      if (options.isPartial) {
        return new Text(theme.fg("warning", "⏳ Reloading runtime..."));
      }

      if (isError) {
        return new Text(`${theme.fg("error", "❌ Reload failed")}\n${theme.fg("muted", details.error || "Unknown error")}`);
      }

      if (details.action === "reloaded") {
        return new Text(`${theme.fg("success", "✅")} ${theme.fg("text", "Runtime reloaded. Extensions, skills, prompts, and themes are refreshed.")}`);
      }

      if (details.action === "reload_queued") {
        return new Text(`${theme.fg("success", "✅")} ${theme.fg("text", "Runtime reload queued. The system will reload shortly.")}`);
      }

      return new Text(theme.fg("text", "Reload complete"));
    }
  };

  api.registerTool(tool);
}
