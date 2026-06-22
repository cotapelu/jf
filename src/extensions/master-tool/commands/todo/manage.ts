#!/usr/bin/env node
import { Text } from "@earendil-works/pi-tui";

/**
 * Todo Manager Command - Stateful Example
 *
 * Demonstrates full stateful command capabilities:
 * - State class with mutex
 * - File persistence (.piclaw/commands/todo.manage.json)
 * - Auto-restore from session/file
 * - Auto-save on dirty
 * - Custom renderer
 *
 * Category: productivity
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, dirname } from "path";
// import { fileURLToPath } from "url"; // unused
import { Mutex } from "../../utils/mutex.js";
// import { withFileMutationQueue } from "@earendil-works/pi-coding-agent"; // unused
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

// __dirname and __filename unused

// ============================================================================
// 1. STATE CLASS
// ============================================================================

export interface TodoItem {
  id: number;
  content: string;
  done: boolean;
  createdAt: number;
}

export class TodoState {
  private _tasks: TodoItem[] = [];
  private _nextId = 1;
  public mutex = new Mutex();
  private _dirty = false;
  private _listeners = new Set<() => void>();

  get tasks(): TodoItem[] { return this._tasks; }
  get isDirty(): boolean { return this._dirty; }
  set isDirty(val: boolean) { this._dirty = val; }

  markDirty(): void {
    this._dirty = true;
    this.notify();
  }

  markClean(): void {
    this._dirty = false;
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this._listeners) l();
  }

  // Atomic add
  async add(content: string): Promise<TodoItem> {
    const release = await this.mutex.lock();
    try {
      const item: TodoItem = {
        id: this._nextId++,
        content,
        done: false,
        createdAt: Date.now()
      };
      this._tasks.push(item);
      this.markDirty();
      return item;
    } finally {
      release();
    }
  }

  // Atomic toggle
  async toggle(id: number): Promise<boolean> {
    const release = await this.mutex.lock();
    try {
      const task = this._tasks.find(t => t.id === id);
      if (!task) return false;
      task.done = !task.done;
      this.markDirty();
      return true;
    } finally {
      release();
    }
  }

  // Atomic remove
  async remove(id: number): Promise<boolean> {
    const release = await this.mutex.lock();
    try {
      const idx = this._tasks.findIndex(t => t.id === id);
      if (idx === -1) return false;
      this._tasks.splice(idx, 1);
      this.markDirty();
      return true;
    } finally {
      release();
    }
  }

  // Get snapshot (clone)
  getSnapshot(): { tasks: TodoItem[]; nextId: number } {
    return {
      tasks: this._tasks.map(t => ({ ...t })),
      nextId: this._nextId
    };
  }

  // Load from file
  async load(ctx: ExtensionContext): Promise<boolean> {
    const filePath = TodoState.getPersistencePath(ctx, "todo.manage");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      const release = await this.mutex.lock();
      try {
        this._tasks = data.tasks?.map((t: any) => ({ ...t, createdAt: t.createdAt ?? Date.now() })) ?? [];
        this._nextId = data.nextId ?? 1;
        this.markClean();
        this.notify();
      } finally {
        release();
      }
      return true;
    } catch {
      // File doesn't exist or parse error - fresh state
      this._tasks = [];
      this._nextId = 1;
      this.markClean();
      return false;
    }
  }

  // Save to file (atomic)
  async save(ctx: ExtensionContext): Promise<void> {
    if (!this.isDirty) return;

    const filePath = TodoState.getPersistencePath(ctx, "todo.manage");
    const dir = dirname(filePath);

    const release = await this.mutex.lock();
    try {
      await fs.mkdir(dir, { recursive: true });

      const snapshot = this.getSnapshot();
      const tempPath = filePath + `.tmp.${Date.now()}.${process.pid}.json`;
      await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2));
      await fs.rename(tempPath, filePath);

      this.markClean();
    } finally {
      release();
    }
  }

  // Static helper to get persistence path
  static getPersistencePath(ctx: ExtensionContext, commandName: string): string {
    return join(ctx.cwd, ".piclaw", "commands", `${commandName}.json`);
  }
}

// ============================================================================
// 2. COMMAND METADATA
// ============================================================================

export const metadata = {
  name: "todo.manage",
  category: "productivity",
  description: "Manage todo list with persistence, mutex safety, and custom UI",
  longDescription: `
Full-featured todo manager with:
- Add, toggle, remove tasks
- Automatic persistence to .piclaw/commands/todo.manage.json
- Mutex-safe concurrent access
- Session restore
- Auto-save on changes
- Beautiful TUI renderer
  `.trim(),
  examples: [
    "master_tool({ command: 'todo.manage', args: { action: 'add', content: 'Buy milk' } })",
    "master_tool({ command: 'todo.manage', args: { action: 'list' } })",
    "master_tool({ command: 'todo.manage', args: { action: 'toggle', id: 1 } })",
    "master_tool({ command: 'todo.manage', args: { action: 'remove', id: 2 } })"
  ],
  tags: ["productivity", "stateful", "example"],
  permissions: ["fs:write"],
  experimental: false
};

// ============================================================================
// 3. SCHEMA
// ============================================================================

export const schema = Type.Object({
  action: Type.Union([
    Type.Literal("add"),
    Type.Literal("list"),
    Type.Literal("toggle"),
    Type.Literal("remove")
  ], { description: "Action to perform" }),
  content: Type.Optional(Type.String({ description: "Task content (required for add)" })),
  id: Type.Optional(Type.Integer({ description: "Task ID (required for toggle/remove)" }))
}, { additionalProperties: false });

// ============================================================================
// 4. EXECUTE (State will be injected via ctx.commandState)
// ============================================================================

export async function execute(
  args: { action: string; content?: string; id?: number },
  cwd: string,
  signal?: AbortSignal,
  ctx?: any
): Promise<{ code: number; stdout: string; stderr: string; data?: any }> {
  // State được executor inject vào ctx.commandState
  const state = (ctx)?.commandState as TodoState | undefined;

  if (!state) {
    // Should never happen nếu executor đã được upgrade
    return {
      code: 1,
      stdout: "",
      stderr: "State not initialized. This command requires stateful support.",
      data: { error: "state_missing" }
    };
  }

  // Check cancellation
  if (signal?.aborted) {
    return {
      code: 1,
      stdout: "",
      stderr: "Operation cancelled",
      data: { error: "cancelled" }
    };
  }

  try {
    switch (args.action) {
      case "add": {
        if (!args.content) {
          return { code: 1, stdout: "", stderr: "content required for add action" };
        }
        const item = await state.add(args.content);
        return {
          code: 0,
          stdout: `✅ Added task #${item.id}: ${item.content}`,
          stderr: "",
          data: { action: "add", item }
        };
      }

      case "list": {
        const tasks = state.tasks;
        const pending = tasks.filter(t => !t.done).length;
        const done = tasks.filter(t => t.done).length;

        let output = `📝 Todo List\n\n`;
        output += `Total: ${tasks.length} (${done} done, ${pending} pending)\n\n`;

        if (tasks.length === 0) {
          output += "No tasks. Add one with action='add'.\n";
        } else {
          for (const task of tasks) {
            const icon = task.done ? "✅" : "⏳";
            output += `${icon} [${task.id}] ${task.content}\n`;
          }
        }

        return {
          code: 0,
          stdout: output.trim(),
          stderr: "",
          data: { action: "list", tasks, stats: { total: tasks.length, done, pending } }
        };
      }

      case "toggle": {
        if (args.id === undefined) {
          return { code: 1, stdout: "", stderr: "id required for toggle action" };
        }
        const toggled = await state.toggle(args.id);
        if (!toggled) {
          return { code: 1, stdout: "", stderr: `Task #${args.id} not found` };
        }
        const taskAfter = state.tasks.find(t => t.id === args.id)!;
        return {
          code: 0,
          stdout: `✅ Toggled task #${args.id}: ${taskAfter.done ? 'done' : 'pending'}`,
          stderr: "",
          data: { action: "toggle", id: args.id, done: taskAfter.done }
        };
      }

      case "remove": {
        if (args.id === undefined) {
          return { code: 1, stdout: "", stderr: "id required for remove action" };
        }
        const removed = await state.remove(args.id);
        if (!removed) {
          return { code: 1, stdout: "", stderr: `Task #${args.id} not found` };
        }
        return {
          code: 0,
          stdout: `✅ Removed task #${args.id}`,
          stderr: "",
          data: { action: "remove", id: args.id }
        };
      }

      default:
        return {
          code: 1,
          stdout: "",
          stderr: `Unknown action: ${args.action}`,
          data: { error: "unknown_action" }
        };
    }
  } catch (error: any) {
    return {
      code: 1,
      stdout: "",
      stderr: `Error: ${error.message}`,
      data: { error: error.message }
    };
  }
}

// ============================================================================
// 5. CUSTOM RENDERER
// ============================================================================

export function renderResult(result: any, options: any, theme: any): any {
  if (result.code !== 0) {
    return new Text(theme.fg("error", `❌ ${result.stderr}`));
  }

  const data = result.data;
  if (!data) {
    return new Text(theme.fg("text", result.stdout));
  }

  const lines: string[] = [];

  switch (data.action) {
    case "add": {
      const item = data.item;
      lines.push(theme.fg("success", `✓ Added todo`));
      lines.push(`${theme.fg("accent", `#${item.id}`)}: ${item.content}`);
      break;
    }

    case "list": {
      lines.push(theme.fg("accent", "📝 Todo List").bold());
      lines.push("");
      lines.push(`Total: ${theme.fg("highlight", data.stats.total.toString())} | ` +
        `${theme.fg("success", data.stats.done + " done")} | ` +
        `${theme.fg("text", data.stats.pending + " pending")}`);

      if (data.tasks.length > 0) {
        lines.push("");
        // Show recent 10
        const recent = data.tasks.slice(-10);
        for (const task of recent) {
          const icon = task.done ? "✅" : "⏳";
          const color = task.done ? "dim" : "text";
          lines.push(`${icon} ${theme.fg(color, `[${task.id}] ${task.content}`)}`);
        }
        if (data.tasks.length > 10) {
          lines.push(theme.fg("dim", `... and ${data.tasks.length - 10} more`));
        }
      } else {
        lines.push("\nNo tasks yet. Add one with action='add'.");
      }
      break;
    }

    case "toggle":
      lines.push(theme.fg("success", `✓ Toggled task #${data.id}`));
      lines.push(`Status: ${data.done ? theme.fg("success", "DONE") : theme.fg("text", "PENDING")}`);
      break;

    case "remove":
      lines.push(theme.fg("warning", `🗑️  Removed task #${data.id}`));
      break;
  }

  return new Text(lines.join("\n"));
}

export const StateClass = TodoState;
export const getPersistencePath = (ctx: ExtensionContext, commandName: string) => TodoState.getPersistencePath(ctx, commandName);