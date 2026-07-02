#!/usr/bin/env node
/**
 * Memory Renderer
 *
 * Beautiful UI for memory tool results.
 * Shows memory list, search results, operations.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { styleError } from "../utils/render-utils.js";

interface Memory {
  id: number;
  text: string;
  tags?: string[];
  created: number;
}

interface MemoryDetails {
  action: string;
  memories: Memory[];
  nextId: number;
  query?: string;
  resultCount?: number;
  target?: Memory;
  deletedId?: number;
  clearedCount?: number;
  error?: string;
}

/**
 * Register the memory renderer.
 */
export function registerMemoryRenderer(api: ExtensionAPI): void {
  if (typeof api.registerMessageRenderer !== 'function') {
    return;
  }

  api.registerMessageRenderer("memory_result", (msg: any, options, theme) => {
    const details = msg.details as MemoryDetails | undefined;
    if (!details) {
      return new Text("🧠 Memory operation");
    }

    const lines: string[] = [];

    // Header
    lines.push(theme.fg("accent", "🧠 Memory").bold());

    // Action
    if (details.action) {
      lines.push(`\nAction: ${details.action}`);
    }

    // Total count
    if (details.memories) {
      lines.push(`Total: ${details.memories.length} memories`);
    }

    // Message content (from tool)
    const contentText = msg.content?.[0]?.text || "";
    if (contentText && !contentText.toLowerCase().includes("error")) {
      lines.push(`\n${contentText}`);
    }

    // Error display
    if (details.error) {
      lines.push(`\n${styleError(theme, `❌ ${details.error}`)}`);
    }

    // Search results - show formatted list
    if (details.action === "search" && details.resultCount && details.resultCount > 0) {
      lines.push("\nMatches:");
      const showMemories = details.memories.slice(0, 15);
      const query = details.query || "";
      for (const mem of showMemories) {
        const icon = query && mem.tags?.some(t => t.toLowerCase().includes(query.toLowerCase())) ? "🏷️" : "📝";
        const id = theme.fg("accent", `#${mem.id}`);
        const preview = mem.text.length > 60 ? `${mem.text.substring(0, 60)  }...` : mem.text;
        const text = theme.fg("text", preview);
        const tags = mem.tags && mem.tags.length > 0 ? theme.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
        lines.push(`  ${icon} ${id} ${text}${tags}`);
      }
      if (details.memories.length > 15) {
        lines.push(`  ${theme.fg("dim", `...and ${details.memories.length - 15} more.`)}`);
      }
    }

    // Single memory view (get)
    if (details.action === "get" && details.target) {
      lines.push("");
      const mem = details.target;
      lines.push(`  ${theme.fg("accent", `Memory #${  mem.id}`)}`);
      lines.push(`  ${theme.fg("text", mem.text)}`);
      if (mem.tags && mem.tags.length > 0) {
        lines.push(`  ${theme.fg("dim", `Tags: ${mem.tags.join(", ")}`)}`);
      }
      const date = new Date(mem.created).toLocaleString();
      lines.push(`  ${theme.fg("dim", `Created: ${date}`)}`);
    }

    return new Text(lines.join("\n"));
  });
}
