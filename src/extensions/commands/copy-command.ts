#!/usr/bin/env node

/**
 * Copy Command
 *
 * Copy last assistant response to clipboard.
 * Usage: /copy (copies most recent assistant message text)
 */

import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
import { copyToClipboard } from "@earendil-works/pi-coding-agent";

function isMessageEntry(entry: SessionEntry): boolean {
  return entry.type === "message";
}

function getMessageRole(entry: SessionEntry): string | null {
  if (entry.type !== "message") return null;
  // @ts-ignore
  const msg = entry.message;
  return msg?.role ?? null;
}

function extractTextContent(message: any): string {
  if (!message?.content) return "";
  const content = message.content as Array<{ type: string; text?: string }>;
  if (!Array.isArray(content)) return "";
  const textParts = content.filter(c => c.type === "text" && c.text).map(c => c.text);
  return textParts.join("\n");
}

export function registerCopyCommand(api: ExtensionAPI): void {
  api.registerCommand("copy", {
    description: "Copy last assistant response to clipboard",
    handler: async (_args: string, ctx) => {
      try {
        const sessionManager = ctx.sessionManager;
        if (!sessionManager) {
          ctx.ui.notify("Session manager not available", "error");
          return;
        }

        // Get full tree (SessionTreeNode[])
        const tree: any[] = sessionManager.getTree();
        if (tree.length === 0) {
          ctx.ui.notify("No session history", "error");
          return;
        }

        // Find last assistant message (reverse iterate)
        let lastAssistantMessage: { entry: SessionEntry; text: string } | null = null;
        for (let i = tree.length - 1; i >= 0; i--) {
          const node = tree[i];
          // Each node is a SessionTreeNode with .entry property
          const entry: SessionEntry = node.entry;
          if (isMessageEntry(entry)) {
            const role = getMessageRole(entry);
            if (role === "assistant") {
              // @ts-ignore
              const msg = entry.message;
              const text = extractTextContent(msg);
              if (text.trim()) {
                lastAssistantMessage = { entry, text };
                break;
              }
            }
          }
        }

        if (!lastAssistantMessage) {
          ctx.ui.notify("No assistant response found", "error");
          return;
        }

        // Copy to clipboard
        await copyToClipboard(lastAssistantMessage.text);
        ctx.ui.notify("Copied last assistant response to clipboard", "info");
      } catch (error: any) {
        ctx.ui.notify(`Failed to copy: ${error?.message || "unknown error"}`, "error");
      }
    },
  });
}
