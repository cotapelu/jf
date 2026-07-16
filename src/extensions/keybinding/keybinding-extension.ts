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

function buildKeyToCmd(bindings: Record<string, string>): Map<string, string> {
  const keyToCmd = new Map<string, string>();
  for (const [cmd, key] of Object.entries(bindings)) {
    if (typeof key === "string" && key.length > 0) {
      const normalized = key.toLowerCase();
      keyToCmd.set(normalized, cmd);
    }
  }
  return keyToCmd;
}

function handleInputData(api: ExtensionAPI, data: string, keyToCmd: Map<string, string>, ctx: ExtensionContext): { consume: boolean } | undefined {
  if (!ctx.isIdle() || !ctx.hasUI) return;
  let received = data;
  if (data.length === 1) {
    const code = data.charCodeAt(0);
    if (code >= 1 && code <= 26) {
      const letter = String.fromCharCode(code + 96);
      received = `ctrl+${letter}`;
    } else if (code === 27) {
      return;
    }
  }
  const normalizedReceived = received.toLowerCase();
  const cmd = keyToCmd.get(normalizedReceived);
  if (!cmd) return;
  try {
    api.sendUserMessage(`/${cmd}`);
  } catch (err: any) {
    ctx.ui.notify(`Failed to execute ${cmd}: ${err?.message || "unknown error"}`, 'error');
  }
  return { consume: true };
}

export function registerKeybindingExtension(api: ExtensionAPI): void {
  api.on('session_start', async (_event, ctx: ExtensionContext) => {
    const bindings = loadKeybindings();
    const keyToCmd = buildKeyToCmd(bindings);
    if (keyToCmd.size === 0) return;
    const unsubscribe = ctx.ui.onTerminalInput((data) => handleInputData(api, data, keyToCmd, ctx));
    api.on('session_shutdown', () => unsubscribe());
  });
}
