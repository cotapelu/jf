#!/usr/bin/env node

/**
 * Keybinding Extension
 *
 * Enables user-defined keyboard shortcuts for slash commands.
 * Configuration: add `keybindings` to ~/.piclaw/config.json, e.g.
 * {
 *   "keybindings": {
 *     "team": "t",
 *     "settings": "s",
 *     "copy": "c",
 *     "providers": "p",
 *     "tree": "ctrl+r"
 *   }
 * }
 *
 * Shortcuts are active only in TUI mode and when the agent is idle.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const AGENT_DIR = getAgentDir();
const CONFIG_DIR_NAME = dirname(AGENT_DIR).split(/[/\\]/).pop() || ".pi";

function loadKeybindings(): Record<string, string> {
  const configPath = join(homedir(), CONFIG_DIR_NAME, "config.json");
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);
    return config.keybindings || {};
  } catch (e) {
    console.error("[KeybindingExtension] Failed to load config:", e);
    return {};
  }
}

export function registerKeybindingExtension(api: ExtensionAPI): void {
  // Listen for session start to set up keybindings
  api.on("session_start", async (_event, ctx: ExtensionContext) => {
    const bindings = loadKeybindings();

    // Build inverse map: key string -> command name
    // Support simple keys (single char) or combos like "ctrl+r", "alt+s", "ctrl+shift+t"
    const keyToCmd = new Map<string, string>();
    for (const [cmd, key] of Object.entries(bindings)) {
      if (typeof key === "string" && key.length > 0) {
        // Normalize: lowercase, but preserve ctrl/alt/shift modifiers (case-insensitive)
        const normalized = key.toLowerCase();
        keyToCmd.set(normalized, cmd);
      }
    }

    if (keyToCmd.size === 0) {
      // No bindings configured, do nothing
      return;
    }

    // Register a terminal input listener
    const unsubscribe = ctx.ui.onTerminalInput((data) => {
      // Only process if agent idle and in TUI mode (to avoid interfering with streaming output)
      if (!ctx.isIdle() || !ctx.hasUI) {
        return; // don't consume
      }

      // data is a string; we want to interpret as raw key sequence
      // For combos, we need to parse control sequences. For simplicity, we treat normalized key string as representation.
      // We'll convert incoming data to a comparable string. For simple keys, it's just the char.
      // For ctrl+letter, terminal sends control bytes (e.g., ctrl+r = 0x12). We'll map common ones.
      // To keep it simple, we only support single printable characters and a few common combos via their string names.
      // We'll check if data matches an entry in keyToCmd directly by string comparison.
      // However, when user presses 't', data = 't'. If binding is "t", it matches.
      // For ctrl+r, data is '\u0012' (ASCII 18). Our normalized key is "ctrl+r". We need to map.
      // We'll create a mapping from actual received char to normalized.
      let received = data;
      // Normalize control characters
      if (data.length === 1) {
        const code = data.charCodeAt(0);
        if (code >= 1 && code <= 26) {
          // ctrl+A = 1 -> ctrl+a
          const letter = String.fromCharCode(code + 96); // 1->a
          received = `ctrl+${letter}`;
        } else if (code === 27) {
          // Escape - ignore
          return;
        }
      }
      const normalizedReceived = received.toLowerCase();

      const cmd = keyToCmd.get(normalizedReceived);
      if (cmd) {
        // Execute slash command via sendUserMessage (handled synchronously by command system)
        try {
          api.sendUserMessage(`/${cmd}`);
        } catch (err: any) {
          ctx.ui.notify(`Failed to execute ${cmd}: ${err?.message || "unknown error"}`, "error");
        }
        // Consume the input so it doesn't go to editor
        return { consume: true };
      }
      // If not matched, let it pass through
    });

    // Ensure cleanup on session shutdown
    api.on("session_shutdown", () => {
      unsubscribe();
    });
  });
}
