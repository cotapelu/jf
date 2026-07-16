#!/usr/bin/env node
import { Text } from "@earendil-works/pi-tui";

/**
 * Demo Counter Command - Minimal Stateful Example
 *
 * Demonstrates simplest stateful command with:
 * - In-memory counter (persisted to file)
 * - Auto-restore, auto-save
 * - Mutex safety
 * - Custom renderer
 *
 * Category: demo
 */

import { Type } from "typebox";
import { Mutex } from "../../utils/mutex.js";
// import { withFileMutationQueue } from "@earendil-works/pi-coding-agent"; // unused
import { join } from "path";
import { promises as fs } from "fs";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

// ============================================================================
// 1. STATE CLASS
// ============================================================================

export class CounterState {
  count = 0;
  mutex = new Mutex();
  private _dirty = false;

  get isDirty(): boolean { return this._dirty; }
  set isDirty(val: boolean) { this._dirty = val; }
  markDirty(): void { this._dirty = true; }
  markClean(): void { this._dirty = false; }

  // Increment (atomic)
  async increment(delta: number = 1): Promise<number> {
    const release = await this.mutex.lock();
    try {
      this.count += delta;
      this.markDirty();
      return this.count;
    } finally {
      release();
    }
  }

  // Reset
  async reset(): Promise<void> {
    const release = await this.mutex.lock();
    try {
      this.count = 0;
      this.markDirty();
    } finally {
      release();
    }
  }

  // Snapshot
  getSnapshot(): { count: number } {
    return { count: this.count };
  }

  // Persistence path (static helper)
  static getPersistencePath(ctx: ExtensionContext, commandName: string): string {
    return join(ctx.cwd, ".piclaw", "demo", `${commandName}.json`);
  }

  // Load from file
  async load(ctx: ExtensionContext): Promise<boolean> {
    const filePath = CounterState.getPersistencePath(ctx, "demo.counter");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      this.count = data.count ?? 0;
      this.markClean();
      return true;
    } catch {
      this.count = 0;
      this.markClean();
      return false;
    }
  }

  // Save to file (atomic)
  async save(ctx: ExtensionContext): Promise<void> {
    if (!this.isDirty) return;

    const filePath = CounterState.getPersistencePath(ctx, "demo.counter");
    const dir = join(ctx.cwd, ".piclaw", "demo");

    const release = await this.mutex.lock();
    try {
      await fs.mkdir(dir, { recursive: true });

      const tempPath = filePath + `.tmp.${Date.now()}.${process.pid}.json`;
      await fs.writeFile(tempPath, JSON.stringify(this.getSnapshot(), null, 2));
      await fs.rename(tempPath, filePath);

      this.markClean();
    } finally {
      release();
    }
  }
}

// ============================================================================
// 2. METADATA
// ============================================================================

export const metadata = {
  name: "demo.counter",
  category: "demo",
  description: "Simple counter with persistence - stateful command example",
  longDescription: `
Increments a counter and persists to .piclaw/demo/demo.counter.json.
Shows how to implement stateful command with:
- StateClass (CounterState)
- Mutex safety
- Auto-restore from file
- Auto-save on dirty
- Custom renderer
  `.trim(),
  examples: [
    "master_tool({ command: 'demo.counter', args: { action: 'inc' } })",
    "master_tool({ command: 'demo.counter', args: { action: 'get' } })",
    "master_tool({ command: 'demo.counter', args: { action: 'reset' } })"
  ],
  tags: ["demo", "stateful", "example"],
  permissions: ["fs:write"],
  experimental: false
};

// ============================================================================
// 3. SCHEMA
// ============================================================================

export const schema = Type.Object({
  action: Type.Union([
    Type.Literal("inc"),
    Type.Literal("get"),
    Type.Literal("reset")
  ], { description: "Action to perform" }),
  delta: Type.Optional(Type.Integer({ description: "Increment amount (default: 1)" }))
}, { additionalProperties: false });

// ============================================================================
// 4. EXECUTE
// ============================================================================

async function handleInc(state: CounterState, args: any): Promise<any> {
  const delta = args.delta ?? 1;
  const newValue = await state.increment(delta);
  return { code: 0, stdout: `🔢 Counter: ${newValue} (added ${delta})`, stderr: "", data: { action: "inc", value: newValue, delta } };
}

async function handleGet(state: CounterState, _args: any): Promise<any> {
  const current = state.count;
  return { code: 0, stdout: `🔢 Counter: ${current}`, stderr: "", data: { action: "get", value: current } };
}

async function handleReset(state: CounterState): Promise<any> {
  await state.reset();
  return { code: 0, stdout: "✅ Counter reset to 0", stderr: "", data: { action: "reset", value: 0 } };
}

export async function execute(
  args: { action: string; delta?: number },
  cwd: string,
  signal?: AbortSignal,
  ctx?: any
): Promise<{ code: number; stdout: string; stderr: string; data?: any }> {
  const state = (ctx)?.commandState as CounterState | undefined;
  if (!state) {
    return { code: 1, stdout: "", stderr: "State not initialized. This command requires stateful support.", data: { error: "state_missing" } };
  }
  if (signal?.aborted) {
    return { code: 1, stdout: "", stderr: "Cancelled", data: { error: "cancelled" } };
  }
  try {
    switch (args.action) {
      case "inc": return await handleInc(state, args);
      case "get": return await handleGet(state, args);
      case "reset": return await handleReset(state);
      default: return { code: 1, stdout: "", stderr: `Unknown action: ${args.action}`, data: { error: "unknown_action" } };
    }
  } catch (error: any) {
    return { code: 1, stdout: "", stderr: `Error: ${error.message}`, data: { error: error.message } };
  }
}

// ============================================================================
// 5. CUSTOM RENDERER
// ============================================================================

function renderInc(data: any, theme: any): any {
  const lines = [
    theme.fg("success", "✅ Incremented"),
    `Counter value: ${theme.fg("highlight", data.value.toString())}`,
    `Added: ${theme.fg("accent", data.delta)}`
  ];
  return new Text(lines.join("\n"));
}

function renderGet(data: any, theme: any): any {
  const lines = [
    theme.fg("accent", "📊 Counter Value"),
    theme.fg("highlight", `   ${data.value}`)
  ];
  return new Text(lines.join("\n"));
}

function renderReset(theme: any): any {
  const lines = [
    theme.fg("warning", "🔄 Reset"),
    "Counter set to 0"
  ];
  return new Text(lines.join("\n"));
}

export function renderResult(result: any, options: any, theme: any): any {
  if (result.code !== 0) {
    return new Text(theme.fg("error", `❌ ${result.stderr}`));
  }
  const data = result.data;
  if (!data) {
    return new Text(theme.fg("text", result.stdout));
  }
  switch (data.action) {
    case "inc": return renderInc(data, theme);
    case "get": return renderGet(data, theme);
    case "reset": return renderReset(theme);
    default: return new Text(theme.fg("text", result.stdout));
  }
}

export const StateClass = CounterState;
export const getPersistencePath = (ctx: ExtensionContext, commandName: string) => CounterState.getPersistencePath(ctx, commandName);
