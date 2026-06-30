#!/usr/bin/env node

import type { ExtensionAPI, ExtensionContext, Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
// import { Type, StringEnum } from "@earendil-works/pi-ai"; // unused
import { matchesKey, Text } from "@earendil-works/pi-tui";

// Simple async mutex to prevent race conditions
class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async lock(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.unlock();
    }
    return new Promise(resolve => {
      this.queue.push(() => resolve(() => this.unlock()));
    });
  }

  private unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

const stateMutex = new Mutex();

export interface Memory {
  id: number;
  text: string;
  tags?: string[];
  created: number;
}

// Helper to build memory list lines (extracted to reduce render method size)
// buildMemoryLines unused - removed

export class MemoryListComponent {
  private memories: Memory[];
  private theme: Theme;
  private onClose: () => void;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(memories: Memory[], theme: Theme, onClose: () => void) {
    this.memories = memories;
    this.theme = theme;
    this.onClose = onClose;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.onClose();
    }
  }

  render(width: number): string[] {
    if (this.cachedWidth && this.cachedWidth === width && this.cachedLines) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const th = this.theme;

    lines.push("");
    lines.push(th.fg("accent", " Memories "));
    lines.push("");

    if (this.memories.length === 0) {
      lines.push(`  ${th.fg("dim", "No memories stored.")}`);
    } else {
      lines.push(`  ${th.fg("muted", `${this.memories.length} memories`)}`);
      lines.push("");
      const maxShow = 50;
      const toShow = this.memories.slice(0, maxShow);
      for (const mem of toShow) {
        const id = th.fg("accent", `#${mem.id}`);
        const preview = mem.text.length > 60 ? mem.text.substring(0, 60) + "..." : mem.text;
        const text = th.fg("text", preview);
        const tags = mem.tags && mem.tags.length > 0 ? th.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
        lines.push(`  ${id} ${text}${tags}`);
      }
      if (this.memories.length > maxShow) {
        lines.push(`  ${th.fg("dim", `...and ${this.memories.length - maxShow} more.`)}`);
      }
    }

    lines.push("");
    lines.push(`  ${th.fg("dim", "Escape=Close")}`);
    lines.push("");

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export function registerMemoryTool(api: ExtensionAPI): void {
  let memories: Memory[] = [];
  let nextId = 1;

  const reconstructState = async (ctx: ExtensionContext) => {
    const release = await stateMutex.lock();
    try {
      memories = [];
      nextId = 1;
      for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.toolName === "memory") {
          // @ts-ignore
          const details = entry.message.details;
          if (details && Array.isArray(details.memories)) {
            memories = details.memories;
            nextId = details.nextId;
          }
        }
      }
    } finally {
      release();
    }
  };

  api.on("session_start", async (_event, ctx) => { await reconstructState(ctx); });
  api.on("session_tree", async (_event, ctx) => { await reconstructState(ctx); });

  const tool: ToolDefinition = {
    name: "memory",
    label: "Memory",
    description: "Store and retrieve arbitrary text snippets with optional tags. Actions: add, list, get, delete, clear, search",
    promptSnippet: "memory({ action: '<action>', ...params })",
    promptGuidelines: [
      "Add: memory({ action: 'add', text: 'Important fact', tags?: ['tag1', 'tag2'] })",
      "List: memory({ action: 'list' })",
      "Get: memory({ action: 'get', id: <number> })",
      "Delete: memory({ action: 'delete', id: <number> })",
      "Clear: memory({ action: 'clear' })",
      "Search: memory({ action: 'search', query: 'text' })",
      "Memories persist in session and support branching.",
      "If the user says 'remember this', 'save this', 'note that', or provides important information (facts, decisions, code snippets, URLs, deadlines), proactively use the memory tool with action 'add' to store it.",
      "Include relevant tags: e.g., ['project', 'code'], ['meeting'], ['decision'], ['research']",
      "Use memory.search to retrieve stored information when the user asks 'what did we say about X', 'do you remember', or references past info.",
      "Prefer storing concise, factual statements rather than long conversational exchanges.",
      "When uncertain if something should be remembered, ask the user: 'Should I save this to memory?'",
    ],
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add","list","get","delete","clear","search"], description: "Action to perform" },
        text: { type: "string", description: "Text to store (required for add)" },
        tags: { type: "array", items: { type: "string" }, description: "Optional tags" },
        id: { type: "number", description: "Memory ID (for get/delete)" },
        query: { type: "string", description: "Search query (for search)" }
      },
      required: ["action"]
    },

    async execute(_toolCallId: string, params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: ExtensionContext) {
      const release = await stateMutex.lock();
      try {
        // Parse JSON string if needed (like todos-tool)
        if (typeof params === "string") {
          try {
            params = JSON.parse(params);
          } catch (e: any) {
            return { content: [{ type: "text", text: `Error: Invalid JSON - ${e.message}` }], details: { action: "unknown", memories: [...memories], nextId, error: "Invalid JSON" }, isError: false };
          }
        }

        const action = params.action as string;

        switch (action) {
          case "add": {
            const text = params.text as string | undefined;
            if (!text) {
              return { content: [{ type: "text", text: "Error: text required for add" }], details: { action, memories: [...memories], nextId, error: "text required" }, isError: false };
            }
            const mem: Memory = {
              id: nextId++,
              text,
              tags: params.tags as string[] | undefined,
              created: Date.now(),
            };
            memories.push(mem);
            api.appendEntry("memory", mem);
            return { content: [{ type: "text", text: `Stored memory #${mem.id}` }], details: { action, memories: [...memories], nextId }, isError: false };
          }

          case "list": {
            const details = { action, memories: [...memories], nextId };
            if (memories.length === 0) {
              return { content: [{ type: "text", text: "No memories stored." }], details, isError: false };
            }
            const lines = memories.map(m => `#${m.id}: ${m.text.length > 80 ? m.text.substring(0, 80) + "..." : m.text}${m.tags ? ` [${m.tags.join(", ")}]` : ""}`);
            return { content: [{ type: "text", text: lines.join("\n") }], details, isError: false };
          }

          case "get": {
            const id = params.id as number | undefined;
            if (id === undefined) {
              return { content: [{ type: "text", text: "Error: id required for get" }], details: { action, memories: [...memories], nextId, error: "id required" }, isError: false };
            }
            const mem = memories.find(m => m.id === id);
            if (!mem) {
              return { content: [{ type: "text", text: `Memory #${id} not found` }], details: { action, memories: [...memories], nextId, targetId: id, error: `#${id} not found` }, isError: false };
            }
            return { content: [{ type: "text", text: mem.text }], details: { action, memories: [...memories], nextId, targetId: id }, isError: false };
          }

          case "delete": {
            const id = params.id as number | undefined;
            if (id === undefined) {
              return { content: [{ type: "text", text: "Error: id required for delete" }], details: { action, memories: [...memories], nextId, error: "id required" }, isError: false };
            }
            const index = memories.findIndex(m => m.id === id);
            if (index === -1) {
              return { content: [{ type: "text", text: `Memory #${id} not found` }], details: { action, memories: [...memories], nextId, targetId: id, error: `#${id} not found` }, isError: false };
            }
            const deleted = memories.splice(index, 1)[0];
            api.appendEntry("memory", { ...deleted, _deleted: true });
            return { content: [{ type: "text", text: `Deleted memory #${id}` }], details: { action, memories: [...memories], nextId, targetId: id }, isError: false };
          }

          case "clear": {
            const count = memories.length;
            for (const mem of memories) {
              api.appendEntry("memory", { ...mem, _deleted: true });
            }
            memories = [];
            nextId = 1;
            return { content: [{ type: "text", text: `Cleared ${count} memories` }], details: { action, memories: [], nextId: 1 }, isError: false };
          }

          case "search": {
            const query = params.query as string | undefined;
            if (!query) {
              return { content: [{ type: "text", text: "Error: query required for search" }], details: { action, memories: [...memories], nextId, error: "query required" }, isError: false };
            }
            const q = query.toLowerCase();
            const results = memories.filter(m => m.text.toLowerCase().includes(q) || (m.tags?.some(t => t.toLowerCase().includes(q))));
            const lines = results.map(m => `#${m.id}: ${m.text}${m.tags ? ` [${m.tags.join(", ")}]` : ""}`);
            const summary = `Found ${results.length} of ${memories.length} memories:\n` + lines.join("\n");
            return { content: [{ type: "text", text: summary }], details: { action: "search", memories: results, nextId }, isError: false };
          }

          default: {
            return { content: [{ type: "text", text: `Unknown action: ${action}` }], details: { action: "list", memories: [...memories], nextId }, isError: false };
          }
        }
      } finally {
        release();
      }
    },

    renderCall(args: any, theme: any, _context: any) {
      const th = theme;
      let text = th.fg("toolTitle", th.bold("memory ")) + th.fg("muted", args.action);
      if (args.text) {
        const preview = args.text.substring(0, 30) + (args.text.length > 30 ? "..." : "");
        text += " " + th.fg("dim", '"' + preview + '"');
      }
      if (args.id !== undefined) text += " " + th.fg("accent", "#" + args.id);
      if (args.tags) text += " " + th.fg("warning", "[" + args.tags.length + " tags]");
      return new Text(text, 0, 0);
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any, _context: any) {
      const th = theme;
      // @ts-ignore
      const details = result.details;

      if (options.isPartial) {
        return new Text(th.fg("warning", "Processing..."), 0, 0);
      }

      if (details && details.error) {
        return new Text(th.fg("error", `Error: ${details.error}`), 0, 0);
      }

      const { action, memories } = details || {};

      switch (action) {
        case "add": {
          const added = memories && memories[memories.length - 1];
          return new Text(th.fg("success", "✓ Stored ") + th.fg("accent", `#${added?.id}`), 0, 0);
        }
        case "list": {
          const count = memories?.length || 0;
          if (count === 0) return new Text(th.fg("dim", "No memories"), 0, 0);
          return new Text(th.fg("success", `✓ ${count} memories`), 0, 0);
        }
        case "get":
        case "delete":
        case "clear":
        case "search": {
          return new Text(th.fg("success", `✓ ${action}`), 0, 0);
        }
        default:
          return new Text(th.fg("muted", result.content?.[0]?.text || ""), 0, 0);
      }
    },
  };

  api.registerTool(tool);
}
