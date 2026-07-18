#!/usr/bin/env node

import type { ExtensionAPI, ExtensionContext, Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { matchesKey, Text } from "@earendil-works/pi-tui";

// Simple async mutex to prevent race conditions
class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];
  async lock(): Promise<() => void> {
    if (!this.locked) { this.locked = true; return () => this.unlock(); }
    return new Promise(resolve => { this.queue.push(() => resolve(() => this.unlock())); });
  }
  private unlock() {
    if (this.queue.length > 0) { const next = this.queue.shift()!; next(); } else { this.locked = false; }
  }
}

const stateMutex = new Mutex();

export interface Memory {
  id: number;
  text: string;
  tags?: string[];
  created: number;
}

// --- State Encapsulation ---

class MemoryState {
  memories: Memory[] = [];
  nextId = 1;
}

// --- Error Builder ---

function buildError(state: MemoryState, action: string, error: string, extra: Record<string, any> = {}): any {
  return {
    content: [{ type: "text" as const, text: `Error: ${error}` }],
    details: { action, memories: [...state.memories], nextId: state.nextId, error, ...extra },
    isError: false
  };
}

// --- Action Handlers (≤20 lines each) ---

function executeAdd(state: MemoryState, api: ExtensionAPI, params: any): any {
  const text = params.text as string | undefined;
  if (!text) return buildError(state, "add", "text required");
  const mem: Memory = { id: state.nextId++, text, tags: params.tags as string[] | undefined, created: Date.now() };
  state.memories.push(mem);
  api.appendEntry("memory", mem);
  return { content: [{ type: "text", text: `Stored memory #${mem.id}` }], details: { action: "add", memories: [...state.memories], nextId: state.nextId }, isError: false };
}

function executeList(state: MemoryState): any {
  const details = { action: "list", memories: [...state.memories], nextId: state.nextId };
  if (state.memories.length === 0) return { content: [{ type: "text", text: "No memories stored." }], details, isError: false };
  const lines = state.memories.map(m => `#${m.id}: ${m.text.length > 80 ? m.text.substring(0, 80) + "..." : m.text}${m.tags ? ` [${m.tags.join(", ")}]` : ""}`);
  return { content: [{ type: "text", text: lines.join("\n") }], details, isError: false };
}

function executeGet(state: MemoryState, api: ExtensionAPI, params: any): any {
  const id = params.id as number | undefined;
  if (id === undefined) return buildError(state, "get", "id required");
  const mem = state.memories.find(m => m.id === id);
  if (!mem) return { content: [{ type: "text", text: `Memory #${id} not found` }], details: { action: "get", memories: [...state.memories], nextId: state.nextId, targetId: id, error: `#${id} not found` }, isError: false };
  return { content: [{ type: "text", text: mem.text }], details: { action: "get", memories: [...state.memories], nextId: state.nextId, targetId: id }, isError: false };
}

function executeDelete(state: MemoryState, api: ExtensionAPI, params: any): any {
  const id = params.id as number | undefined;
  if (id === undefined) return buildError(state, "delete", "id required");
  const index = state.memories.findIndex(m => m.id === id);
  if (index === -1) return { content: [{ type: "text", text: `Memory #${id} not found` }], details: { action: "delete", memories: [...state.memories], nextId: state.nextId, targetId: id, error: `#${id} not found` }, isError: false };
  const deleted = state.memories.splice(index, 1)[0];
  api.appendEntry("memory", { ...deleted, _deleted: true });
  return { content: [{ type: "text", text: `Deleted memory #${id}` }], details: { action: "delete", memories: [...state.memories], nextId: state.nextId, targetId: id }, isError: false };
}

function executeClear(state: MemoryState, api: ExtensionAPI): any {
  const count = state.memories.length;
  for (const mem of state.memories) api.appendEntry("memory", { ...mem, _deleted: true });
  state.memories = [];
  state.nextId = 1;
  return { content: [{ type: "text", text: `Cleared ${count} memories` }], details: { action: "clear", memories: [], nextId: state.nextId }, isError: false };
}

function executeSearch(state: MemoryState, params: any): any {
  const query = params.query as string | undefined;
  if (!query) return buildError(state, "search", "query required");
  const q = query.toLowerCase();
  const results = state.memories.filter(m => m.text.toLowerCase().includes(q) || (m.tags?.some(t => t.toLowerCase().includes(q))));
  const lines = results.map(m => `#${m.id}: ${m.text}${m.tags ? ` [${m.tags.join(", ")}]` : ""}`);
  const summary = `Found ${results.length} of ${state.memories.length} memories:\n` + lines.join("\n");
  return { content: [{ type: "text", text: summary }], details: { action: "search", memories: results, nextId: state.nextId }, isError: false };
}

// --- State Restoration ---

const reconstructState = async (state: MemoryState, api: ExtensionAPI, ctx: ExtensionContext) => {
  const release = await stateMutex.lock();
  try {
    state.memories = [];
    state.nextId = 1;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message" || entry.message.role !== "toolResult" || entry.message.toolName !== "memory") continue;
      // @ts-ignore
      const details = entry.message.details;
      if (!details || !Array.isArray(details.memories)) continue;
      state.memories = details.memories;
      state.nextId = details.nextId;
    }
  } finally {
    release();
  }
};

// --- TUI Component: Memory List ---

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
    this.cachedLines = buildMemoryLines(this.memories, this.theme);
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

function buildMemoryLines(memories: Memory[], theme: Theme, maxShow = 50): string[] {
  const th = theme;
  const lines: string[] = [];
  lines.push("");
  lines.push(th.fg("accent", " Memories "));
  lines.push("");
  if (memories.length === 0) {
    lines.push(`  ${th.fg("dim", "No memories stored.")}`);
  } else {
    lines.push(`  ${th.fg("muted", `${memories.length} memories`)}`);
    lines.push("");
    lines.push(...renderMemoryList(memories, theme, maxShow));
  }
  lines.push("");
  lines.push(`  ${th.fg("dim", "Escape=Close")}`);
  lines.push("");
  return lines;
}

function renderMemoryList(memories: Memory[], theme: Theme, maxShow: number): string[] {
  const th = theme;
  const toShow = memories.slice(0, maxShow);
  const lines: string[] = [];
  for (const mem of toShow) {
    const id = th.fg("accent", `#${mem.id}`);
    const preview = mem.text.length > 60 ? mem.text.substring(0, 60) + "..." : mem.text;
    const text = th.fg("text", preview);
    const tags = mem.tags && mem.tags.length > 0 ? th.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
    lines.push(`  ${id} ${text}${tags}`);
  }
  if (memories.length > maxShow) {
    lines.push(`  ${th.fg("dim", `...and ${memories.length - maxShow} more.`)}`);
  }
  return lines;
}

// --- Render Helpers (module-level) ---

function renderPartial(theme: Theme): Text { return new Text(theme.fg("warning", "Processing..."), 0, 0); }
function renderError(theme: Theme, error: string): Text { return new Text(theme.fg("error", `Error: ${error}`), 0, 0); }
function renderDefault(result: any, theme: Theme): Text { return new Text(theme.fg("muted", result.content?.[0]?.text || ""), 0, 0); }
function renderAdd(details: any, theme: Theme): Text {
  const added = details.memories && details.memories[details.memories.length - 1];
  return new Text(theme.fg("success", "✓ Stored ") + theme.fg("accent", `#${added?.id}`), 0, 0);
}
function renderList(details: any, theme: Theme): Text {
  const count = details.memories?.length || 0;
  if (count === 0) return new Text(theme.fg("dim", "No memories"), 0, 0);
  return new Text(theme.fg("success", `✓ ${count} memories`), 0, 0);
}
function renderSuccess(action: string, theme: Theme): Text {
  return new Text(theme.fg("success", `✓ ${action}`), 0, 0);
}

function memoryRenderCall(args: any, theme: any, _context: any): Text {
  const th = theme;
  let text = th.fg("toolTitle", th.bold("memory ")) + th.fg("muted", args.action);
  if (args.text) {
    const preview = args.text.substring(0, 30) + (args.text.length > 30 ? "..." : "");
    text += " " + th.fg("dim", '"' + preview + '"');
  }
  if (args.id !== undefined) text += " " + th.fg("accent", "#" + args.id);
  if (args.tags) text += " " + th.fg("warning", "[" + args.tags.length + " tags]");
  return new Text(text, 0, 0);
}

function memoryRenderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any, _context: any): Text {
  const th = theme;
  if (options.isPartial) return renderPartial(th);
  const details = result.details;
  if (details?.error) return renderError(th, details.error);
  const { action } = details || {};
  switch (action) {
    case "add": return renderAdd(details, th);
    case "list": return renderList(details, th);
    case "get":
    case "delete":
    case "clear":
    case "search": return renderSuccess(action, th);
    default: return renderDefault(result, th);
  }
}

// --- Tool Metadata (module-level constant) ---

const MEMORY_TOOL_METADATA = {
  name: "memory" as const,
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
    required: ["action"] as const
  }
};

// --- Execute Handler Factory ---

function parseParams(params: any): { data: any } | { error: string } {
  if (typeof params === "string") {
    try { return { data: JSON.parse(params) }; } catch (e: any) { return { error: e.message }; }
  }
  return { data: params };
}

function dispatchAction(state: MemoryState, api: ExtensionAPI, action: string, params: any) {
  switch (action) {
    case "add": return executeAdd(state, api, params);
    case "list": return executeList(state);
    case "get": return executeGet(state, api, params);
    case "delete": return executeDelete(state, api, params);
    case "clear": return executeClear(state, api);
    case "search": return executeSearch(state, params);
    default: return buildError(state, "unknown_action", `Unknown action: ${action}`);
  }
}

function createExecuteHandler(state: MemoryState, api: ExtensionAPI, mutex: Mutex) {
  return async (_toolCallId: string, params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: ExtensionContext) => {
    const release = await mutex.lock();
    try {
      const parsed = parseParams(params);
      if ('error' in parsed) return buildError(state, "invalid_json", parsed.error);
      const action = parsed.data.action as string;
      return await dispatchAction(state, api, action, parsed.data);
    } finally { release(); }
  };
}

// --- Registration ---

export function registerMemoryTool(api: ExtensionAPI): void {
  const state = new MemoryState();

  // Setup event listeners to restore state from session
  api.on("session_start", async (_event, ctx) => { await reconstructState(state, api, ctx); });
  api.on("session_tree", async (_event, ctx) => { await reconstructState(state, api, ctx); });

  const tool: ToolDefinition = {
    ...MEMORY_TOOL_METADATA,
    execute: createExecuteHandler(state, api, stateMutex),
    renderCall: memoryRenderCall,
    renderResult: memoryRenderResult,
  };

  api.registerTool(tool);
}
