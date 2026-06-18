#!/usr/bin/env node
import { logger } from "../../utils/logger.js";
/**
 * Full-Featured Todo Tool - Complete implementation with all backup features
 * - 6 ops: delete, add_phase, add_task, update, remove_task, list
 * - Auto-normalize: one in_progress task
 * - File persistence: ./.piclaw/agent/todos.json
 * - System messages + auto-continue
 * - Strict validation + mergeCallAndResult
 */

import { existsSync, mkdirSync, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { ToolDefinition, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// ============================================================================
// Simple async mutex to prevent race conditions
// ============================================================================
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

// Global mutex shared across all instances (state is global anyway)
const stateMutex = new Mutex();

// ============================================================================
// Types
// ============================================================================

export type TodoStatus = "pending" | "in_progress" | "completed" | "abandoned";

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  notes?: string;
  details?: string;
}

export interface TodoPhase {
  id: string;
  name: string;
  tasks: TodoItem[];
}

export interface TodoFile {
  phases: TodoPhase[];
  nextTaskId: number;
  nextPhaseId: number;
}

interface PersistedTodo {
  version: 1;
  phases: TodoPhase[];
  nextTaskId: number;
  nextPhaseId: number;
  updatedAt: string;
}

// BACKUP: storage detection - session vs file
export interface TodoToolDetails {
  phases: TodoPhase[];
  storage: "session" | "memory" | "file";  // Added "file" for extension
  error?: string;
}

// ============================================================================
// Schemas - REMOVED: Using manual validation inside execute to reduce token size
// ============================================================================
//
// Previously we had complex TypeBox schemas:
// const StatusEnum = Type.String();
// const InputTask = Type.Object({ content: Type.String(), status: Type.Optional(StatusEnum), ... });
// ... etc
//
// Now we use parameters: {} and validate manually in execute()

// ============================================================================
// File I/O - Project-based storage
// ============================================================================

function getProjectTodoFilePath(): string {
  return join(process.cwd(), ".piclaw", "agent", "todos.json");
}

async function loadTodoFromFile(): Promise<TodoFile | null> {
  const filePath = getProjectTodoFilePath();
  if (!existsSync(filePath)) return null;
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed: PersistedTodo = JSON.parse(content);
    if (parsed.version !== 1) return null;
    return { phases: parsed.phases, nextTaskId: parsed.nextTaskId, nextPhaseId: parsed.nextPhaseId };
  } catch (e) {
    logger.error("Load todos failed", { error: e });
    return null;
  }
}

async function saveTodoToFile(todo: TodoFile): Promise<void> {
  const filePath = getProjectTodoFilePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
  const persisted: PersistedTodo = {
    version: 1,
    phases: todo.phases,
    nextTaskId: todo.nextTaskId,
    nextPhaseId: todo.nextPhaseId,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(persisted, null, 2));
}

// ============================================================================
// Helpers (IDENTICAL to backup)
// ============================================================================

function clonePhases(phases: TodoPhase[]): TodoPhase[] {
  return phases.map(p => ({ ...p, tasks: p.tasks.map(t => ({ ...t })) }));
}

function findTask(phases: TodoPhase[], id: string): TodoItem | undefined {
  for (const phase of phases) {
    const task = phase.tasks.find(t => t.id === id);
    if (task) return task;
  }
  return undefined;
}

function buildPhaseFromInput(
  input: { name: string; tasks?: Array<{ content: string; status?: string; notes?: string; details?: string }> },
  phaseId: string,
  nextTaskId: number,
): { phase: TodoPhase; nextTaskId: number } {
  const tasks: TodoItem[] = [];
  let tid = nextTaskId;
  for (const t of input.tasks ?? []) {
    // Cast status to TodoStatus if valid, otherwise default to pending
    let status: TodoStatus = "pending";
    if (t.status && ["pending", "in_progress", "completed", "abandoned"].includes(t.status)) {
      status = t.status as TodoStatus;
    }
    tasks.push({
      id: `task-${tid++}`,
      content: t.content,
      status,
      notes: t.notes,
      details: t.details,
    });
  }
  return { phase: { id: phaseId, name: input.name, tasks }, nextTaskId: tid };
}

function getNextIds(phases: TodoPhase[]): { nextTaskId: number; nextPhaseId: number } {
  let maxTaskId = 0;
  let maxPhaseId = 0;

  for (const phase of phases) {
    const phaseMatch = /^phase-(\d+)$/.exec(phase.id);
    if (phaseMatch) {
      const value = Number.parseInt(phaseMatch[1], 10);
      if (Number.isFinite(value) && value > maxPhaseId) maxPhaseId = value;
    }

    for (const task of phase.tasks) {
      const taskMatch = /^task-(\d+)$/.exec(task.id);
      if (!taskMatch) continue;
      const value = Number.parseInt(taskMatch[1], 10);
      if (Number.isFinite(value) && value > maxTaskId) maxTaskId = value;
    }
  }

  return { nextTaskId: maxTaskId + 1, nextPhaseId: maxPhaseId + 1 };
}

function normalizeInProgress(phases: TodoPhase[]): void {
  const all = phases.flatMap(p => p.tasks);
  if (all.length === 0) return;
  const inProg = all.filter(t => t.status === "in_progress");
  if (inProg.length > 1) for (const t of inProg.slice(1)) t.status = "pending";
  if (inProg.length > 0) return;
  const first = all.find(t => t.status === "pending");
  if (first) first.status = "in_progress";
}

// ============================================================================
// Input normalization (IDENTICAL to backup)
// ============================================================================

export function normalizeParams(params: unknown): any {
  if (typeof params === "string") {
    try {
      params = JSON.parse(params);
    } catch (e) {
      throw new Error(`Invalid JSON string: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (typeof params !== "object" || params === null) {
    throw new Error("Parameters must be an object");
  }

  const normalized = params as Record<string, unknown>;

  if (normalized.add_phase && typeof normalized.add_phase === "string") {
    try {
      normalized.add_phase = JSON.parse(normalized.add_phase);
    } catch (e) {
      throw new Error(
        `add_phase must be an object, not a string. Error parsing: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (normalized.add_phase && typeof normalized.add_phase === "object") {
    const addPhase = normalized.add_phase as Record<string, unknown>;
    if (addPhase.name && typeof addPhase.name === "string" && addPhase.name.startsWith("{")) {
      try {
        const parsed = JSON.parse(addPhase.name);
        if (typeof parsed === "object" && parsed !== null) {
          normalized.add_phase = parsed;
        }
      } catch {
        // Keep original if parse fails
      }
    }
  }

  if (normalized.add_phase && typeof normalized.add_phase === "object") {
    const addPhase = normalized.add_phase as Record<string, unknown>;
    if (addPhase.tasks && typeof addPhase.tasks === "string") {
      try {
        addPhase.tasks = JSON.parse(addPhase.tasks);
      } catch {
        addPhase.tasks = (addPhase.tasks as string).split(",").map((s) => ({ content: s.trim() }));
      }
    }
  }

  if (normalized.delete !== undefined && typeof normalized.delete === "string") {
    try {
      normalized.delete = JSON.parse(normalized.delete);
    } catch (e) {
      throw new Error(
        `delete must be an object, not a string. Error parsing: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Auto-parse other ops if they are strings
  ["add_task", "update", "remove_task", "delete"].forEach(op => {
    if (normalized[op] && typeof normalized[op] === "string") {
      try {
        normalized[op] = JSON.parse(normalized[op]);
      } catch (e) {
        throw new Error(
          `${op} must be an object, not a string. Error parsing: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  });

  return normalized as any;
}

// ============================================================================
// Apply single op (IDENTICAL to backup)
// ============================================================================

function makeEmptyFile(): TodoFile {
  return { phases: [], nextTaskId: 1, nextPhaseId: 1 };
}

function applySingleOp(file: TodoFile, params: any): { file: TodoFile; errors: string[] } {
  const errors: string[] = [];

  if (params.delete !== undefined) {
    file = makeEmptyFile();
    return { file, errors };
  }

  if (params.add_phase) {
    const op = params.add_phase;
    if (!op || typeof op !== "object") {
      errors.push("add_phase must be an object");
      return { file, errors };
    }
    if (!op.name || typeof op.name !== "string") {
      errors.push("add_phase.name must be a string (not an object or array)");
      return { file, errors };
    }
    if (op.tasks && !Array.isArray(op.tasks)) {
      errors.push("add_phase.tasks must be an array");
      return { file, errors };
    }
    const phaseId = `phase-${file.nextPhaseId++}`;
    const { phase, nextTaskId } = buildPhaseFromInput(op, phaseId, file.nextTaskId);
    file.phases.push(phase);
    file.nextTaskId = nextTaskId;
    normalizeInProgress(file.phases);
    return { file, errors };
  }

  if (params.add_task) {
    const op = params.add_task;
    if (!op || typeof op !== "object") {
      errors.push("add_task must be an object");
      return { file, errors };
    }
    if (!op.phase || typeof op.phase !== "string") {
      errors.push("add_task.phase must be a string (e.g., 'phase-1' or phase name)");
      return { file, errors };
    }
    if (!op.content || typeof op.content !== "string") {
      errors.push("add_task.content must be a string");
      return { file, errors };
    }
    // Support lookup by phase name OR phase ID
    const target = file.phases.find((p) => p.id === op.phase || p.name === op.phase);
    if (!target) {
      errors.push(`Phase "${op.phase}" not found`);
    } else {
      target.tasks.push({
        id: `task-${file.nextTaskId++}`,
        content: op.content,
        status: "pending",
        notes: op.notes,
        details: op.details,
      });
    }
    normalizeInProgress(file.phases);
    return { file, errors };
  }

  if (params.update) {
    const op = params.update;
    if (!op || typeof op !== "object") {
      errors.push("update must be an object");
      return { file, errors };
    }

    // Support batch update with ids array OR single id
    let taskIds: string[];
    if (op.ids && Array.isArray(op.ids)) {
      taskIds = op.ids;
    } else if (op.id && typeof op.id === "string") {
      taskIds = [op.id];
    } else {
      errors.push("update must have either 'id' (string) or 'ids' (array of strings)");
      return { file, errors };
    }

    let hasValidUpdates = false;
    for (const taskId of taskIds) {
      const task = findTask(file.phases, taskId);
      if (!task) {
        errors.push(`Task "${taskId}" not found`);
        continue;
      }
      hasValidUpdates = true;
      if (op.status !== undefined) {
        if (typeof op.status === "string" && ["pending", "in_progress", "completed", "abandoned"].includes(op.status)) {
          task.status = op.status as TodoStatus;
        } else {
          errors.push(`Invalid status: ${op.status}. Must be pending, in_progress, completed, or abandoned.`);
        }
      }
      if (op.content !== undefined) task.content = op.content;
      if (op.notes !== undefined) task.notes = op.notes;
      if (op.details !== undefined) task.details = op.details;
    }

    if (!hasValidUpdates && taskIds.length > 0) {
      errors.push("No valid tasks found to update");
    }
    normalizeInProgress(file.phases);
    return { file, errors };
  }

  if (params.remove_task) {
    const op = params.remove_task;
    if (!op || typeof op !== "object") {
      errors.push("remove_task must be an object");
      return { file, errors };
    }
    if (!op.id || typeof op.id !== "string") {
      errors.push("remove_task.id must be a string (e.g., 'task-1')");
      return { file, errors };
    }
    let removed = false;
    for (const phase of file.phases) {
      const idx = phase.tasks.findIndex((t) => t.id === op.id);
      if (idx !== -1) {
        phase.tasks.splice(idx, 1);
        removed = true;
        break;
      }
    }
    if (!removed) {
      errors.push(`Task "${op.id}" not found`);
    }
    normalizeInProgress(file.phases);
    return { file, errors };
  }

  if (params.list !== undefined) {
    return { file, errors };
  }

  errors.push("No operation specified");
  normalizeInProgress(file.phases);
  return { file, errors };
}

export function formatSummary(phases: TodoPhase[], errors: string[]): string {
  const tasks = phases.flatMap((p) => p.tasks);
  if (tasks.length === 0) return errors.length > 0 ? `Errors: ${errors.join("; ")}` : "Todo list cleared.";

  const remainingByPhase = phases
    .map((phase) => ({
      name: phase.name,
      tasks: phase.tasks.filter((task) => task.status === "pending" || task.status === "in_progress"),
    }))
    .filter((phase) => phase.tasks.length > 0);
  const remainingTasks = remainingByPhase.flatMap((phase) =>
    phase.tasks.map((task) => ({ ...task, phase: phase.name })),
  );

  let currentIdx = phases.findIndex((p) => p.tasks.some((t) => t.status === "pending" || t.status === "in_progress"));
  if (currentIdx === -1) currentIdx = phases.length - 1;
  const current = phases[currentIdx];
  const done = current?.tasks.filter((t) => t.status === "completed" || t.status === "abandoned").length ?? 0;

  const lines: string[] = [];
  if (errors.length > 0) {
    lines.push(`⚠️ Errors: ${errors.join("; ")}`);
  } else {
    const pending = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    lines.push(`✅ Todo updated: ${pending} remaining, ${completed} completed.`);
    lines.push(`📊 Use /todos to view, or continue with next task.`);
    lines.push("");
  }
  if (remainingTasks.length === 0) {
    lines.push("Remaining items: none.");
  } else {
    lines.push(`Remaining items (${remainingTasks.length}):`);
    for (const task of remainingTasks) {
      lines.push(`  - ${task.id} ${task.content} [${task.status}] (${task.phase})`);
      if (task.status === "in_progress" && task.details) {
        for (const line of task.details.split("\n")) {
          lines.push(`      ${line}`);
        }
      }
    }
  }
  lines.push(
    `Phase ${currentIdx + 1}/${phases.length} "${current?.name ?? "unknown"}" — ${done}/${current?.tasks.length ?? 0} tasks complete`,
  );
  return lines.join("\n");
}

// ============================================================================
// Helper functions (from backup)
// ============================================================================

function countOperations(params: any): number {
  let count = 0;
  if (params.add_phase) count++;
  if (params.add_task) count++;
  if (params.update) count++;
  if (params.remove_task) count++;
  if (params.delete !== undefined) count++;
  if (params.list !== undefined) count++;
  return count;
}

function getOperationName(params: any): string {
  if (params.delete !== undefined) return "delete";
  if (params.add_phase) return "add_phase";
  if (params.add_task) return "add_task";
  if (params.update) return "update";
  if (params.remove_task) return "remove_task";
  if (params.list !== undefined) return "list";
  return "unknown";
}


export function applyOp(
  phases: TodoPhase[],
  nextTaskId: number,
  nextPhaseId: number,
  params: any
): { phases: TodoPhase[]; nextTaskId: number; nextPhaseId: number; errors: string[] } {
  const file: TodoFile = { phases, nextTaskId, nextPhaseId };
  const { file: updated, errors } = applySingleOp(file, params as any);
  return {
    phases: updated.phases,
    nextTaskId: updated.nextTaskId,
    nextPhaseId: updated.nextPhaseId,
    errors
  };
}

// BACKUP: getLatestTodoPhasesFromEntries (reconstruct from history)
export function getLatestTodoPhasesFromEntries(entries: any[]): TodoPhase[] {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "message") continue;

    const message = entry.message as { role?: string; toolName?: string; details?: unknown; isError?: boolean };
    if (message.role !== "toolResult" || (message.toolName !== "todos" && message.toolName !== "todo_write") || message.isError) continue;

    const details = message.details as { phases?: unknown } | undefined;
    if (!details || !Array.isArray(details.phases)) continue;

    return clonePhases(details.phases as TodoPhase[]);
  }

  return [];
}

// ============================================================================
// State (Enhanced with session-based detection)
// ============================================================================

export class TodoState {
  phases: TodoPhase[] = [];
  nextTaskId: number = 1;
  nextPhaseId: number = 1;
  storageType: "session" | "memory" | "file" = "file"; // NEW: track storage type
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { for (const l of this.listeners) l(); }

  async loadFromFile(): Promise<boolean> {
    const fileData = await loadTodoFromFile();
    if (!fileData) { this.phases = []; this.nextTaskId = 1; this.nextPhaseId = 1; this.storageType = "file"; return false; }
    this.phases = clonePhases(fileData.phases);
    this.nextTaskId = fileData.nextTaskId;
    this.nextPhaseId = fileData.nextPhaseId;
    this.storageType = "file";
    this.notify();
    return true;
  }

  async saveToFile(): Promise<void> {
    const ids = getNextIds(this.phases);
    await saveTodoToFile({ phases: clonePhases(this.phases), nextTaskId: ids.nextTaskId, nextPhaseId: ids.nextPhaseId });
  }

  // BACKUP: reconstructFromEntries (identical logic)
  reconstructFromEntries(entries: any[]): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.type !== "message") continue;
      const m = e.message;
      if (m.role !== "toolResult" || (m.toolName !== "todos" && m.toolName !== "todo_write")) continue;
      const d = m.details as any;
      if (d?.phases) {
        this.phases = clonePhases(d.phases);
        const ids = getNextIds(this.phases);
        this.nextTaskId = ids.nextTaskId;
        this.nextPhaseId = ids.nextPhaseId;
        break;
      }
    }
  }

  // BACKUP: All these methods are identical
  addPhase(name: string, tasks?: any[]): TodoPhase {
    const phaseId = `phase-${this.nextPhaseId++}`;
    const { phase, nextTaskId } = buildPhaseFromInput({ name, tasks }, phaseId, this.nextTaskId);
    this.nextTaskId = nextTaskId;
    this.phases.push(phase);
    normalizeInProgress(this.phases);
    this.notify();
    return phase;
  }

  addTask(phaseId: string, content: string, notes?: string, details?: string): TodoItem | null {
    const phase = this.phases.find(p => p.id === phaseId);
    if (!phase) return null;
    phase.tasks.push({ id: `task-${this.nextTaskId++}`, content, status: "pending", notes, details });
    normalizeInProgress(this.phases);
    this.notify();
    return phase.tasks[phase.tasks.length - 1];
  }

  updateTask(taskId: string, updates: Partial<Pick<TodoItem, "status" | "content" | "notes" | "details">>): TodoItem | null {
    const task = findTask(this.phases, taskId);
    if (!task) return null;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.content !== undefined) task.content = updates.content;
    if (updates.notes !== undefined) task.notes = updates.notes;
    if (updates.details !== undefined) task.details = updates.details;
    normalizeInProgress(this.phases);
    this.notify();
    return task;
  }

  removeTask(taskId: string): boolean {
    for (const phase of this.phases) {
      const idx = phase.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        phase.tasks.splice(idx, 1);
        normalizeInProgress(this.phases);
        this.notify();
        return true;
      }
    }
    return false;
  }

  replacePhases(phases: TodoPhase[]): void {
    this.phases = clonePhases(phases);
    normalizeInProgress(this.phases);
    const ids = getNextIds(this.phases);
    this.nextTaskId = ids.nextTaskId;
    this.nextPhaseId = ids.nextPhaseId;
    this.notify();
  }

  getPhases(): TodoPhase[] {
    return clonePhases(this.phases);
  }

  // NEW: method to set storage type
  setStorageType(type: "session" | "memory" | "file"): void {
    this.storageType = type;
  }
}

// ============================================================================
// Render Functions (Enhanced with backup's formatTodoLine)
// ============================================================================

// BACKUP: formatTodoLine function (adapted for pi-tui Text)
function formatTodoLineExtension(item: TodoItem, theme: any, prefix: string): string {
  // Since we're using Text, we can't mix colors inline. We'll return plain text.
  // For colored output, we'd need multiple Text segments or use theme.fg.
  switch (item.status) {
    case "completed":
      return `${prefix}[✓] ${item.content}`;
    case "in_progress": {
      const main = `${prefix}[→] ${item.content}`;
      if (!item.details) return main;
      const detailLines = item.details.split("\n").map(l => `${prefix}  ${l}`);
      return [main, ...detailLines].join("\n");
    }
    case "abandoned":
      return `${prefix}[✗] ${item.content}`;
    default:
      return `${prefix}[ ] ${item.content}`;
  }
}

function renderTodosCall(args: any, theme: any): Text {
  const op = args.delete !== undefined ? "delete" : args.add_phase ? "add_phase" : args.add_task ? "add_task" : args.update ? "update" : args.remove_task ? "remove_task" : args.list ? "list" : "todo";
  const text = `${theme.fg("toolTitle", theme.bold("todos"))} ${theme.fg("muted", op)}`;
  return new Text(text, 0, 0);
}

function renderTodosResult(result: { details?: TodoToolDetails }, options: { expanded: boolean; isPartial: boolean }, theme: any): Text {
  const details = result.details as TodoToolDetails | undefined;
  if (!details) return new Text("", 0, 0);
  if (details.error) return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  if (options.isPartial) return new Text(theme.fg("warning", "Processing..."), 0, 0);

  const phases = details.phases.filter((p: any) => p.tasks.length > 0);
  const allTasks = phases.flatMap((p: any) => p.tasks);
  if (allTasks.length === 0) return new Text(theme.fg("dim", "No todos"), 0, 0);

  const lines: string[] = [theme.fg("toolTitle", `Todos: ${allTasks.length} tasks`)];
  for (const phase of phases) {
    if (phases.length > 1) lines.push(theme.fg("accent", `▼ ${phase.name}`));
    const displayTasks = options.expanded ? phase.tasks : phase.tasks.slice(0, 5);
    for (const task of displayTasks) {
      const color = task.status === "completed" || task.status === "abandoned" ? "dim" : task.status === "in_progress" ? "accent" : "text";
      const prefix = task.status === "in_progress" ? "→" : task.status === "completed" ? "✓" : task.status === "abandoned" ? "✗" : " ";
      lines.push(`${theme.fg(color, `  ${prefix} ${task.id} ${task.content}`)}`);
      if (task.status === "in_progress" && task.details) {
        for (const line of task.details.split("\n")) {
          lines.push(theme.fg("dim", `    ${line}`));
        }
      }
    }

    if (!options.expanded && phase.tasks.length > 5) {
      lines.push(theme.fg("dim", `  ... ${phase.tasks.length - 5} more`));
    }
  }

  return new Text(lines.join("\n"), 0, 0);
}

// ============================================================================
// Tool Factory (with mergeCallAndResult support)
// ============================================================================

function createTodoTool(api: ExtensionAPI): ToolDefinition<any, TodoToolDetails> {
  const state = new TodoState();
  let autoTriggering = false;

  api.on("session_start", async (_event, ctx) => {
    const release = await stateMutex.lock();
    try {
      // Try to reconstruct from session history first (backward compatibility)
      state.reconstructFromEntries(ctx.sessionManager.getBranch());
      // Then load from file (file takes precedence if exists)
      const loaded = await state.loadFromFile();
      if (!loaded) {
        // If no file, mark as memory/session storage
        state.setStorageType("memory");
      }
    } finally {
      release();
    }
  });

  api.on("session_tree", async (_event, ctx) => {
    const release = await stateMutex.lock();
    try {
      state.reconstructFromEntries(ctx.sessionManager.getBranch());
      await state.loadFromFile();
      // If we reconstructed from entries but file exists, file is source of truth
      // If file doesn't exist, we're in memory/session mode
      const filePath = getProjectTodoFilePath();
      if (!existsSync(filePath)) {
        state.setStorageType("memory");
      } else {
        state.setStorageType("file");
      }
    } finally {
      release();
    }
  });

  // Auto-continue: only when agent ends (idle), check if there are pending tasks
  api.on("agent_end", async () => {
    if (autoTriggering) return; // Avoid re-entrancy

    const phases = state.getPhases();
    const hasPendingTasks = phases.some(phase =>
      phase.tasks.some(task => task.status !== "completed" && task.status !== "abandoned")
    );

    if (!hasPendingTasks) return;

    autoTriggering = true;
    try {
      await api.sendMessage({
        customType: "todo-auto-continue",
        content: "Continue with the next task. If no tasks remain, validate the work and add new tasks.",
        display: false,
        details: { autoTrigger: true, timestamp: Date.now() }
      }, { triggerTurn: true, deliverAs: "followUp" });
    } catch (e) {
      logger.error("[todos] Auto-continue failed", { error: e });
    } finally {
      setTimeout(() => { autoTriggering = false; }, 500);
    }
  });

  return {
    name: "todos",
    label: "Todo",
    description: "Complete todo management: add_phase, add_task, update, remove_task, delete, list. Auto-normalizes ONE in_progress task. Persists to .piclaw/agent/todos.json. add_task accepts phase name or ID. update supports batch update via ids array.",
    promptSnippet: "todos({ OPERATION: {...} }). All params are OBJECTS (not JSON strings). Ops: add_phase, add_task, update, remove_task, delete, list.",
    promptGuidelines: [
      "RULE: Operation is the KEY. todos({ OPERATION: params }), NOT { operation: name, params: {...} }",
      "",
      "TEMPLATES:",
      "• add_phase: todos({ add_phase: { name: 'Phase', tasks: [{ content: 'Task' }] } })",
      "• add_task:  todos({ add_task: { phase: 'phase-1', content: 'Task' } })",
      "  ⚠️ phase must be ID (phase-1), NOT name",
      "• update:    todos({ update: { id: 'task-5', status: 'in_progress' } })",
      "  Batch:    todos({ update: { ids: ['task-1','task-2'], status: 'completed' } })",
      "  status: pending|in_progress|completed|abandoned",
      "• remove_task: todos({ remove_task: { id: 'task-3' } })",
      "• delete: todos({ delete: {} })",
      "• list: todos({ list: {} })",
      "",
      "AUTO-RULES:",
      "• Only ONE task can be 'in_progress' (auto-normalizes others to 'pending')",
      "• Data persists to .piclaw/agent/todos.json",
      "• Use 'details' field only for in_progress context (multiline)",
      "• Task IDs are auto: task-1, task-2... Find them by running todos({ list: {} })",
    ],
    parameters: {},

    async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: ((update: any) => void) | undefined, ctx: ExtensionContext) {
      let p: any;
      try {
        if (typeof params === "string") params = JSON.parse(params);
        if (typeof params !== "object" || params === null) throw new Error("object required");
        p = params;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `❌ Error: ${msg}` }], details: { phases: state.getPhases(), storage: state.storageType, error: msg }, isError: true };
      }

      // Normalize - parse JSON strings
      try {
        p = normalizeParams(p);
      } catch (e: any) {
        return { content: [{ type: "text", text: `❌ Error: ${e.message}` }], details: { phases: state.getPhases(), storage: state.storageType, error: e.message }, isError: true };
      }

      const errors: string[] = [];

      const opCount = countOperations(p);
      if (opCount === 0) errors.push("No operation specified. Use: add_phase, add_task, update, remove_task, delete, or list");
      if (opCount > 1) errors.push("Multiple operations detected. Use only ONE operation per call.");

      const opName = getOperationName(p);
      const op = opName === "unknown" ? null : opName;
      if (!op) { errors.push("No operation. Use: add_phase, add_task, update, remove_task, list"); }

      // Apply pure operation
      const { phases: newPhases, nextTaskId: newTid, nextPhaseId: newPid, errors: opErrors } = applyOp(
        state.phases,
        state.nextTaskId,
        state.nextPhaseId,
        p
      );
      errors.push(...opErrors);

      // Update state
      state.phases = newPhases;
      state.nextTaskId = newTid;
      state.nextPhaseId = newPid;

      if (errors.length === 0 && op !== "list") {
        try {
          await state.saveToFile();
          state.setStorageType("file");
        } catch (e: any) {
          errors.push(`Save failed: ${e.message}`);
          state.setStorageType("memory");
        }
      }

      const resultPhases = state.getPhases();
      const summaryText = formatSummary(resultPhases, errors);

      // System message
      if (op && op !== "list" && errors.length === 0) {
        try {
          await api.sendMessage({
            customType: "todo_update",
            content: `[System: Todo ${op}] ${summaryText.split("\n")[0]}`,
            display: false
          }, { triggerTurn: false });
        } catch {}
      }



      return {
        content: [{ type: "text", text: summaryText }],
        details: { phases: resultPhases, storage: state.storageType, error: errors.length ? errors.join("; ") : undefined },
        isError: errors.length > 0
      };
    },

    renderCall: renderTodosCall,
    renderResult: renderTodosResult,
  };
}

// ============================================================================
// Export
// ============================================================================

export function registerTodosTool(api: ExtensionAPI): void {
  api.registerTool(createTodoTool(api));
}


