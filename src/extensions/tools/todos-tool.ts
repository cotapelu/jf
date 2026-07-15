#!/usr/bin/env node
/**
 * Full-Featured Todo Tool - Complete implementation with all backup features
 * - 6 ops: delete, add_phase, add_task, update, remove_task, list
 * - Auto-normalize: one in_progress task
 * - File persistence: ./${CONFIG_DIR_NAME}/agent/todos.json
 * - System messages + auto-continue
 * - Strict validation + mergeCallAndResult
 *
 * @module tools/todos-tool
 */

import { existsSync, promises as fs } from "node:fs"; // mkdirSync unused
import { dirname, join } from "node:path";
import type { ToolDefinition, ExtensionAPI, ExtensionContext, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Mutex } from "../utils/mutex.js";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
// import { getAgentDir } from "@earendil-works/pi-coding-agent"; // unused

const CONFIG_DIR_NAME = ".piclaw";
// --- Types (migrated from tool-types.ts) ---
export type TodoStatus = "pending" | "in_progress" | "completed" | "abandoned";

export interface TodoTaskInput {
  content: string;
  status?: TodoStatus;
  notes?: string;
  details?: string;
}

export interface TodoPhaseInput {
  name: string;
  tasks?: TodoTaskInput[];
}

export interface TodosAddPhaseParams {
  add_phase: TodoPhaseInput;
}

export interface TodosAddTaskParams {
  add_task: {
    phase: string;
    content: string;
    notes?: string;
    details?: string;
  };
}

export interface TodosUpdateParams {
  update: {
    id?: string;
    ids?: string[];
    status?: TodoStatus;
    content?: string;
    notes?: string;
    details?: string;
  };
}

export interface TodosRemoveTaskParams {
  remove_task: { id: string };
}

export interface TodosDeleteParams {
  delete: Record<string, never>;
}

export interface TodosListParams {
  list: Record<string, never>;
}

export type TodosParams =
  | TodosAddPhaseParams
  | TodosAddTaskParams
  | TodosUpdateParams
  | TodosRemoveTaskParams
  | TodosDeleteParams
  | TodosListParams;

// Result types
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

export interface TodoToolDetails {
  phases: TodoPhase[];
  storage: "session" | "memory" | "file";
  error?: string;
}

export interface TodoFile {
  phases: TodoPhase[];
  nextTaskId: number;
  nextPhaseId: number;
}


// Per-session state storage
interface TodoSessionState {
  state: TodoState;
  mutex: Mutex;
}
const sessionStates = new WeakMap<ExtensionContext, TodoSessionState>();

function getSessionState(ctx: ExtensionContext): TodoSessionState {
  let s = sessionStates.get(ctx);
  if (!s) {
    const mutex = new Mutex();
    const state = new TodoState();
    s = { state, mutex };
    sessionStates.set(ctx, s);
  }
  return s;
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

function getProjectTodoFilePath(cwd: string): string {
  return join(cwd, CONFIG_DIR_NAME, "agent", "todos.json");
}

async function loadTodoFromFile(cwd: string): Promise<TodoFile | null> {
  const filePath = getProjectTodoFilePath(cwd);
  if (!existsSync(filePath)) return null;
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed: PersistedTodo = JSON.parse(content);
    if (parsed.version !== 1) return null;
    return { phases: parsed.phases, nextTaskId: parsed.nextTaskId, nextPhaseId: parsed.nextPhaseId };
  } catch (e) {
    console.error("Load todos failed:", e);
    return null;
  }
}

async function saveTodoToFile(cwd: string, todo: TodoFile): Promise<void> {
  const filePath = getProjectTodoFilePath(cwd);
  const dir = dirname(filePath);
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
  const persisted: PersistedTodo = {
    version: 1,
    phases: todo.phases,
    nextTaskId: todo.nextTaskId,
    nextPhaseId: todo.nextPhaseId,
    updatedAt: new Date().toISOString(),
  };
  // Atomic write: write to temp file then rename
  const tempPath = filePath + `.tmp.${Date.now()}.${process.pid}.json`;
  await fs.writeFile(tempPath, JSON.stringify(persisted, null, 2));
  await fs.rename(tempPath, filePath);
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
  let maxTaskId = 0, maxPhaseId = 0;
  for (const phase of phases) {
    const pm = /^phase-(\d+)$/.exec(phase.id);
    if (pm) {
      const v = parseInt(pm[1], 10);
      if (Number.isFinite(v) && v > maxPhaseId) maxPhaseId = v;
    }
    for (const task of phase.tasks) {
      const tm = /^task-(\d+)$/.exec(task.id);
      if (!tm) continue;
      const v = parseInt(tm[1], 10);
      if (Number.isFinite(v) && v > maxTaskId) maxTaskId = v;
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
// Input normalization helpers (extracted)
// ============================================================================

function parseJsonField(obj: Record<string, unknown>, key: string, fieldName?: string): void {
  if (obj[key] && typeof obj[key] === "string") {
    try {
      obj[key] = JSON.parse(obj[key]);
    } catch (e) {
      throw new Error(`${fieldName || key} must be an object, not a string. Error parsing: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function parseAddPhase(normalized: Record<string, unknown>): void {
  if (!normalized.add_phase) return;
  parseJsonField(normalized, "add_phase");
  const addPhase = normalized.add_phase as Record<string, unknown>;
  if (addPhase.name && typeof addPhase.name === "string" && addPhase.name.startsWith("{")) {
    try { addPhase.name = JSON.parse(addPhase.name); } catch {}
  }
  if (addPhase.tasks && typeof addPhase.tasks === "string") {
    try { addPhase.tasks = JSON.parse(addPhase.tasks); } catch { addPhase.tasks = (addPhase.tasks as string).split(",").map(s => ({ content: s.trim() })); }
  }
}

function parseStringOps(normalized: Record<string, unknown>, ops: string[]): void {
  ops.forEach(op => {
    if (normalized[op] && typeof normalized[op] === "string") {
      try { normalized[op] = JSON.parse(normalized[op]); }
      catch (e) { throw new Error(`${op} must be an object, not a string. Error parsing: ${e instanceof Error ? e.message : String(e)}`); }
    }
  });
}

export function normalizeParams(params: unknown): any {
  if (typeof params === "string") params = JSON.parse(params);
  if (typeof params !== "object" || params === null) throw new Error("Parameters must be an object");
  const normalized = params as Record<string, unknown>;
  parseAddPhase(normalized);
  parseStringOps(normalized, ["add_task", "update", "remove_task", "delete"]);
  // @ts-ignore
  return normalized;
}

// ============================================================================
// Apply single op (IDENTICAL to backup)
// ============================================================================

function makeEmptyFile(): TodoFile {
  return { phases: [], nextTaskId: 1, nextPhaseId: 1 };
}

// Helper to apply update operations to a single task, reducing nesting depth.
function applyTaskUpdates(task: TodoItem, op: any, errors: string[]): void {
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

// Operation handlers for applySingleOp (extracted for length compliance)
function applyDeleteOp(_file: TodoFile): { file: TodoFile; errors: string[] } {
  return { file: makeEmptyFile(), errors: [] };
}

function applyAddPhaseOp(file: TodoFile, op: any): { file: TodoFile; errors: string[] } {
  const errors: string[] = [];
  if (!op || typeof op !== "object") { errors.push("add_phase must be an object"); return { file, errors }; }
  if (!op.name || typeof op.name !== "string") { errors.push("add_phase.name must be a string (not an object or array)"); return { file, errors }; }
  if (op.tasks && !Array.isArray(op.tasks)) { errors.push("add_phase.tasks must be an array"); return { file, errors }; }
  const phaseId = `phase-${file.nextPhaseId++}`;
  const { phase, nextTaskId } = buildPhaseFromInput(op, phaseId, file.nextTaskId);
  file.phases.push(phase);
  file.nextTaskId = nextTaskId;
  normalizeInProgress(file.phases);
  return { file, errors };
}

function applyAddTaskOp(file: TodoFile, op: any): { file: TodoFile; errors: string[] } {
  const errors: string[] = [];
  if (!op || typeof op !== "object") { errors.push("add_task must be an object"); return { file, errors }; }
  if (!op.phase || typeof op.phase !== "string") { errors.push("add_task.phase must be a string (e.g., 'phase-1' or phase name)"); return { file, errors }; }
  if (!op.content || typeof op.content !== "string") { errors.push("add_task.content must be a string"); return { file, errors }; }
  const target = file.phases.find((p) => p.id === op.phase || p.name === op.phase);
  if (!target) { errors.push(`Phase "${op.phase}" not found`); }
  else { target.tasks.push({ id: `task-${file.nextTaskId++}`, content: op.content, status: "pending", notes: op.notes, details: op.details }); }
  normalizeInProgress(file.phases);
  return { file, errors };
}

function applyUpdateOp(file: TodoFile, op: any): { file: TodoFile; errors: string[] } {
  const errors: string[] = [];
  if (!op || typeof op !== "object") { errors.push("update must be an object"); return { file, errors }; }
  let taskIds: string[];
  if (op.ids && Array.isArray(op.ids)) taskIds = op.ids;
  else if (op.id && typeof op.id === "string") taskIds = [op.id];
  else { errors.push("update must have either 'id' (string) or 'ids' (array of strings)"); return { file, errors }; }
  let hasValidUpdates = false;
  for (const taskId of taskIds) {
    const task = findTask(file.phases, taskId);
    if (!task) { errors.push(`Task "${taskId}" not found`); continue; }
    hasValidUpdates = true;
    applyTaskUpdates(task, op, errors);
  }
  if (!hasValidUpdates && taskIds.length > 0) errors.push("No valid tasks found to update");
  normalizeInProgress(file.phases);
  return { file, errors };
}

function applyRemoveTaskOp(file: TodoFile, op: any): { file: TodoFile; errors: string[] } {
  const errors: string[] = [];
  if (!op || typeof op !== "object") { errors.push("remove_task must be an object"); return { file, errors }; }
  if (!op.id || typeof op.id !== "string") { errors.push("remove_task.id must be a string (e.g., 'task-1')"); return { file, errors }; }
  let removed = false;
  for ( const phase of file.phases) {
    const idx = phase.tasks.findIndex((t) => t.id === op.id);
    if (idx !== -1) { phase.tasks.splice(idx, 1); removed = true; break; }
  }
  if (!removed) errors.push(`Task "${op.id}" not found`);
  normalizeInProgress(file.phases);
  return { file, errors };
}

function applyListOp(_file: TodoFile): { file: TodoFile; errors: string[] } {
  return { file: _file, errors: [] };
}


function applySingleOp(file: TodoFile, params: any): { file: TodoFile; errors: string[] } {
  const errors: string[] = [];
  if (params.delete !== undefined) return applyDeleteOp(file);
  if (params.add_phase) return applyAddPhaseOp(file, params.add_phase);
  if (params.add_task) return applyAddTaskOp(file, params.add_task);
  if (params.update) return applyUpdateOp(file, params.update);
  if (params.remove_task) return applyRemoveTaskOp(file, params.remove_task);
  if (params.list !== undefined) return applyListOp(file);
  errors.push("No operation specified");
  normalizeInProgress(file.phases);
  return { file, errors };
}


function renderSummaryHeader(errors: string[], tasks: TodoItem[]): string[] {
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
  return lines;
}

function renderRemainingTasksList(remainingTasks: Array<TodoItem & { phase: string }>): string[] {
  if (remainingTasks.length === 0) return ["Remaining items: none."];
  const lines: string[] = [`Remaining items (${remainingTasks.length}):`];
  remainingTasks.forEach(task => {
    lines.push(`  - ${task.id} ${task.content} [${task.status}] (${task.phase})`);
    if (task.status === "in_progress" && task.details) {
      task.details.split("\n").forEach(line => lines.push(`      ${line}`));
    }
  });
  return lines;
}

function renderPhaseProgress(
  current: TodoPhase | undefined,
  currentIdx: number,
  phases: TodoPhase[]
): string {
  const done = current?.tasks.filter((t) => t.status === "completed" || t.status === "abandoned").length ?? 0;
  return `Phase ${currentIdx + 1}/${phases.length} "${current?.name ?? "unknown"}" — ${done}/${current?.tasks.length ?? 0} tasks complete`;
}

export function formatSummary(phases: TodoPhase[], errors: string[]): string {
  const tasks = phases.flatMap(p => p.tasks);
  if (tasks.length === 0) return errors.length > 0 ? `Errors: ${errors.join("; ")}` : "Todo list cleared.";
  const remainingTasks = phases
    .map(p => ({ name: p.name, tasks: p.tasks.filter(t => t.status === "pending" || t.status === "in_progress") }))
    .filter(p => p.tasks.length > 0)
    .flatMap(p => p.tasks.map(t => ({ ...t, phase: p.name })));
  let currentIdx = phases.findIndex(p => p.tasks.some(t => t.status === "pending" || t.status === "in_progress"));
  if (currentIdx === -1) currentIdx = phases.length - 1;
  const current = phases[currentIdx];
  const lines: string[] = [];
  lines.push(...renderSummaryHeader(errors, tasks));
  lines.push(...renderRemainingTasksList(remainingTasks));
  lines.push(renderPhaseProgress(current, currentIdx, phases));
  return lines.join("\n");
}

/**
 * Extracts the latest todo phases from a list of message entries.
 * Used for reconstructing state from conversation history.
 */
export function getLatestTodoPhasesFromEntries(entries: any[]): TodoPhase[] {
  // Iterate from the end to find the most recent valid todos toolResult
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== 'message') continue;
    const message = entry.message;
    if (!message || message.role !== 'toolResult') continue;
    const toolName = message.toolName;
    if (toolName !== 'todos' && toolName !== 'todo_write') continue;
    // Skip error entries (they may have isError flag)
    if (message.isError) continue;
    const details = message.details;
    if (details && Array.isArray(details.phases)) {
      return details.phases;
    }
  }
    return [];
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
  // @ts-ignore
  const { file: updated, errors } = applySingleOp(file, params);
  return {
    phases: updated.phases,
    nextTaskId: updated.nextTaskId,
    nextPhaseId: updated.nextPhaseId,
    errors
  };
}

// ============================================================================
// State (Enhanced with session-based detection)
// ============================================================================
export class TodoState {
  phases: TodoPhase[] = []; nextTaskId: number = 1; nextPhaseId: number = 1; storageType: "session" | "memory" | "file" = "file"; private listeners: Set<() => void> = new Set();
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const l of this.listeners) l(); }
  async loadFromFile(cwd: string): Promise<boolean> { const fileData = await loadTodoFromFile(cwd); if (!fileData) { this.phases = []; this.nextTaskId = 1; this.nextPhaseId = 1; this.storageType = "file"; return false; } this.phases = clonePhases(fileData.phases); this.nextTaskId = fileData.nextTaskId; this.nextPhaseId = fileData.nextPhaseId; this.storageType = "file"; this.notify(); return true; }
  async saveToFile(cwd: string): Promise<void> { const ids = getNextIds(this.phases); await saveTodoToFile(cwd, { phases: clonePhases(this.phases), nextTaskId: ids.nextTaskId, nextPhaseId: ids.nextPhaseId }); }
  reconstructFromEntries(entries: any[]): boolean { let found = false; for (let i = entries.length - 1; i >= 0; i--) { const e = entries[i]; if (e.type !== "message") continue; const m = e.message; if (m.role !== "toolResult" || (m.toolName !== "todos" && m.toolName !== "todo_write")) continue; const d = (m).details; if (d?.phases) { this.phases = clonePhases(d.phases); const ids = getNextIds(this.phases); this.nextTaskId = ids.nextTaskId; this.nextPhaseId = ids.nextPhaseId; found = true; break; } } return found; }
  addPhase(name: string, tasks?: any[]): TodoPhase { const phaseId = `phase-NaN`; const { phase, nextTaskId } = buildPhaseFromInput({ name, tasks }, phaseId, this.nextTaskId); this.nextTaskId = nextTaskId; this.phases.push(phase); normalizeInProgress(this.phases); this.notify(); return phase; }
  addTask(phaseId: string, content: string, notes?: string, details?: string): TodoItem | null { const phase = this.phases.find(p => p.id === phaseId); if (!phase) return null; phase.tasks.push({ id: `task-NaN`, content, status: "pending", notes, details }); normalizeInProgress(this.phases); this.notify(); return phase.tasks[phase.tasks.length - 1]; }
  updateTask(taskId: string, updates: Partial<Pick<TodoItem, "status" | "content" | "notes" | "details">>): TodoItem | null { const task = findTask(this.phases, taskId); if (!task) return null; if (updates.status !== undefined) task.status = updates.status; if (updates.content !== undefined) task.content = updates.content; if (updates.notes !== undefined) task.notes = updates.notes; if (updates.details !== undefined) task.details = updates.details; normalizeInProgress(this.phases); this.notify(); return task; }
  removeTask(taskId: string): boolean { for (const phase of this.phases) { const idx = phase.tasks.findIndex(t => t.id === taskId); if (idx !== -1) { phase.tasks.splice(idx, 1); normalizeInProgress(this.phases); this.notify(); return true; } } return false; }
  replacePhases(phases: TodoPhase[]): void { this.phases = clonePhases(phases); normalizeInProgress(this.phases); const ids = getNextIds(this.phases); this.nextTaskId = ids.nextTaskId; this.nextPhaseId = ids.nextPhaseId; this.notify(); }
  getPhases(): TodoPhase[] { return clonePhases(this.phases); }
  setStorageType(type: "session" | "memory" | "file"): void { this.storageType = type; }
}

// ============================================================================
// Render Functions (Enhanced with backup's formatTodoLine)
// ============================================================================

// BACKUP: formatTodoLine function (adapted for pi-tui Text)
// formatTodoLineExtension unused - removed
function renderTodosCall(args: any, theme: any): Text {
  const op = args.delete !== undefined ? "delete" : args.add_phase ? "add_phase" : args.add_task ? "add_task" : args.update ? "update" : args.remove_task ? "remove_task" : args.list ? "list" : "todo";
  const text = `${theme.fg("toolTitle", theme.bold("todos"))} ${theme.fg("muted", op)}`;
  return new Text(text, 0, 0);
}

function renderTaskLine(task: any, theme: any): string {
  const color = task.status === "completed" || task.status === "abandoned" ? "dim" : task.status === "in_progress" ? "accent" : "text";
  const prefix = task.status === "in_progress" ? "→" : task.status === "completed" ? "✓" : task.status === "abandoned" ? "✗" : " ";
  return `${theme.fg(color, `  ${prefix} ${task.id} ${task.content}`)}`;
}

function renderPhase(phase: any, expanded: boolean, theme: any): string[] {
  const lines: string[] = [];
  if (expanded) {
    phase.tasks.forEach((task: any) => {
      lines.push(renderTaskLine(task, theme));
      if (task.status === "in_progress" && task.details) {
        task.details.split("\n").forEach((line: any) => lines.push(theme.fg("dim", `    ${line}`)));
      }
    });
  } else {
    phase.tasks.slice(0, 5).forEach((task: any) => lines.push(renderTaskLine(task, theme)));
    if (phase.tasks.length > 5) lines.push(theme.fg("dim", `  ... ${phase.tasks.length - 5} more`));
  }
  return lines;
}

function renderTodosResult(result: { details?: TodoToolDetails }, options: { expanded: boolean; isPartial: boolean }, theme: any): Text {
  const details = result.details;
  if (!details) return new Text("", 0, 0);
  if (details.error) return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  if (options.isPartial) return new Text(theme.fg("warning", "Processing..."), 0, 0);

  const phases = details.phases.filter((p: any) => p.tasks.length > 0);
  const allTasks = phases.flatMap((p: any) => p.tasks);
  if (allTasks.length === 0) return new Text(theme.fg("dim", "No todos"), 0, 0);

  const lines: string[] = [theme.fg("toolTitle", `Todos: ${allTasks.length} tasks`)];
  phases.forEach(phase => {
    if (phases.length > 1) lines.push(theme.fg("accent", `▼ ${phase.name}`));
    lines.push(...renderPhase(phase, options.expanded, theme));
  });

  return new Text(lines.join("\n"), 0, 0);
}


// ============================================================================
// Helper functions for execute (length compliance)
// ============================================================================

function parseAndValidateParams(params: any): { p: any; errors: string[] } {
  try {
    let p = params;
    if (typeof params === "string") p = JSON.parse(params);
    if (typeof p !== "object" || p === null) return { p: null, errors: ["Parameters must be an object"] };
    p = normalizeParams(p);
    return { p, errors: [] };
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return { p: null, errors: [msg] };
  }
}

function getOperationInfo(p: any): { op: string | null; errors: string[] } {
  const errors: string[] = [];
  const opCount = countOperations(p);
  if (opCount === 0) errors.push("No operation specified. Use: add_phase, add_task, update, remove_task, delete, or list");
  if (opCount > 1) errors.push("Multiple operations detected. Use only ONE operation per call.");
  const opName = getOperationName(p);
  const op = opName === "unknown" ? null : opName;
  if (!op) errors.push("No operation. Use: add_phase, add_task, update, remove_task, list");
  return { op, errors };
}

async function applyAndUpdateState(session: TodoSessionState, p: any): Promise<{ errors: string[] }> {
  const { phases, nextTaskId, nextPhaseId, errors } = applyOp(
    session.state.phases,
    session.state.nextTaskId,
    session.state.nextPhaseId,
    p
  );
  session.state.phases = phases;
  session.state.nextTaskId = nextTaskId;
  session.state.nextPhaseId = nextPhaseId;
  return { errors };
}

async function persistStateIfNeeded(
  session: TodoSessionState,
  ctx: ExtensionContext,
  op: string,
  errors: string[]
): Promise<void> {
  if (errors.length === 0 && op !== "list") {
    try {
      const filePath = getProjectTodoFilePath(ctx.cwd);
      await withFileMutationQueue(filePath, async () => {
        await session.state.saveToFile(ctx.cwd);
      });
      session.state.setStorageType("file");
    } catch (e: any) {
      errors.push(`Save failed: ${e.message}`);
      session.state.setStorageType("memory");
    }
  }
}

function formatResultSummary(session: TodoSessionState, errors: string[]): string {
  return formatSummary(session.state.getPhases(), errors);
}

async function maybeSendSystemMessage(api: ExtensionAPI, op: string, summaryText: string): Promise<void> {
  try {
    // @ts-ignore - api has sendMessage
    await api.sendMessage(
      { customType: "todo_update", content: `[System: Todo ${op}] ${summaryText.split("\n")[0]}`, display: false },
      { triggerTurn: false }
    );
  } catch {}
}

function buildResult(session: TodoSessionState, errors: string[], summaryText: string): AgentToolResult<TodoToolDetails> {
  return {
    content: [{ type: "text", text: summaryText }],
    details: { phases: session.state.getPhases(), storage: session.state.storageType, error: errors.length ? errors.join("; ") : undefined },
    isError: errors.length > 0
  };
}

// ============================================================================
// Tool Factory (with mergeCallAndResult support)
// ============================================================================

function createTodoTool(api: ExtensionAPI): ToolDefinition<any, TodoToolDetails> {
  // No per-session state; global constants only

  api.on("session_start", async (_event, ctx) => {
    const session = getSessionState(ctx);
    const cwd = ctx.cwd;
    const release = await session.mutex.lock();
    try {
      const found = session.state.reconstructFromEntries(ctx.sessionManager.getBranch());
      if (!found) {
        // Load file without lock (read-only)
        const loaded = await session.state.loadFromFile(cwd);
        if (!loaded) {
          session.state.setStorageType("memory");
        }
        // If loaded, loadFromFile already set storage to "file"
      } else {
        session.state.setStorageType("session");
      }
    } finally {
      release();
    }
  });

  api.on("session_tree", async (_event, ctx) => {
    const session = getSessionState(ctx);
    const cwd = ctx.cwd;
    const release = await session.mutex.lock();
    try {
      const found = session.state.reconstructFromEntries(ctx.sessionManager.getBranch());
      if (!found) {
        // Load file without lock (read-only)
        const loaded = await session.state.loadFromFile(cwd);
        if (!loaded) {
          session.state.setStorageType("memory");
        }
        // If loaded, loadFromFile already set storage to "file"
      } else {
        session.state.setStorageType("session");
      }
    } finally {
      release();
    }
  });

  return {
    name: "todos",
    label: "Todo",
    description: "Complete todo management: add_phase, add_task, update, remove_task, delete, list. Auto-normalizes ONE in_progress task. Persists to " + CONFIG_DIR_NAME + "/agent/todos.json. add_task accepts phase name or ID. update supports batch update via ids array.",
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
      "• Data persists to " + CONFIG_DIR_NAME + "/agent/todos.json",
      "• Use 'details' field only for in_progress context (multiline)",
      "• Task IDs are auto: task-1, task-2... Find them by running todos({ list: {} })",
    ],
    parameters: {},

    /**
     * Execute a todos operation.
     *
     * @param toolCallId - Unique identifier for this tool call
     * @param params - Operation parameters (TodosParams) or JSON string
     * @param _signal - Optional abort signal
     * @param _onUpdate - Optional update callback
     * @param ctx - Extension context containing session manager
     * @returns Promise resolving to tool result with content, details, and error flag
     */
    async execute(
      toolCallId: string,
      params: TodosParams | string,
      _signal: AbortSignal | undefined,
      _onUpdate: (update: any) => void | undefined,
      ctx: ExtensionContext
    ) {
      const session = getSessionState(ctx);
      const release = await session.mutex.lock();
      try {
        const { p, errors: parseErrors } = parseAndValidateParams(params);
        if (parseErrors.length > 0) {
          return buildResult(session, parseErrors, formatResultSummary(session, parseErrors));
        }
        const { op, errors: opErrors } = getOperationInfo(p);
        if (opErrors.length > 0) {
          return buildResult(session, opErrors, formatResultSummary(session, opErrors));
        }
        const { errors: applyErrors } = await applyAndUpdateState(session, p);
        const allErrors = [...parseErrors, ...opErrors, ...applyErrors];
        await persistStateIfNeeded(session, ctx, op!, allErrors);
        const summaryText = formatResultSummary(session, allErrors);
        if (op && op !== "list" && allErrors.length === 0) {
          await maybeSendSystemMessage(api, op, summaryText);
        }
        return buildResult(session, allErrors, summaryText);
      } finally {
        release();
      }
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


