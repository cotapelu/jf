import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import { StringEnum } from "@mariozechner/pi-ai";
import type { Component } from "@mariozechner/pi-tui";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import chalk from "chalk";
import type { Theme } from "../../modes/interactive/theme/theme.js";
import type { AgentSession } from "../agent-session.js";
import type { SessionEntry } from "../session-manager.js";

// =============================================================================
// Types
// =============================================================================

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

export interface TodoWriteToolDetails {
	phases: TodoPhase[];
	storage: "session" | "memory";
}

// =============================================================================
// Schema
// =============================================================================

const StatusEnum = StringEnum(["pending", "in_progress", "completed", "abandoned"] as const, {
	description: "Task status",
});

const InputTask = Type.Object({
	content: Type.String({ description: "Task description" }),
	status: Type.Optional(StatusEnum),
	notes: Type.Optional(Type.String({ description: "Additional context or notes" })),
	details: Type.Optional(Type.String({ description: "Implementation details, file paths, and specifics" })),
});

const InputPhase = Type.Object({
	name: Type.String({ description: "Phase name" }),
	tasks: Type.Optional(Type.Array(InputTask)),
});

const todoWriteSchema = Type.Object({
	ops: Type.Array(
		Type.Union([
			Type.Object({
				op: Type.Literal("replace"),
				phases: Type.Array(InputPhase),
			}),
			Type.Object({
				op: Type.Literal("add_phase"),
				name: Type.String({ description: "Phase name" }),
				tasks: Type.Optional(Type.Array(InputTask)),
			}),
			Type.Object({
				op: Type.Literal("add_task"),
				phase: Type.String({ description: "Phase ID, e.g. phase-1" }),
				content: Type.String({ description: "Task description" }),
				notes: Type.Optional(Type.String({ description: "Additional context or notes" })),
				details: Type.Optional(Type.String({ description: "Implementation details, file paths, and specifics" })),
			}),
			Type.Object({
				op: Type.Literal("update"),
				id: Type.String({ description: "Task ID, e.g. task-3" }),
				status: Type.Optional(StatusEnum),
				content: Type.Optional(Type.String({ description: "Updated task description" })),
				notes: Type.Optional(Type.String({ description: "Additional context or notes" })),
				details: Type.Optional(Type.String({ description: "Updated details" })),
			}),
			Type.Object({
				op: Type.Literal("remove_task"),
				id: Type.String({ description: "Task ID, e.g. task-3" }),
			}),
		]),
	),
});

type TodoWriteParams = Static<typeof todoWriteSchema>;

// =============================================================================
// File format
// =============================================================================

interface TodoFile {
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

// =============================================================================
// Persistence helpers
// =============================================================================

function getTodoFilePath(sessionDir: string): string {
	return join(sessionDir, "todos.json");
}

function loadTodoFromFile(sessionDir: string): TodoFile | null {
	const filePath = getTodoFilePath(sessionDir);
	if (!existsSync(filePath)) return null;

	try {
		const content = readFileSync(filePath, "utf-8");
		const parsed: PersistedTodo = JSON.parse(content);
		if (parsed.version !== 1) return null;
		return { phases: parsed.phases, nextTaskId: parsed.nextTaskId, nextPhaseId: parsed.nextPhaseId };
	} catch {
		return null;
	}
}

function saveTodoToFile(sessionDir: string, todo: TodoFile): void {
	const filePath = getTodoFilePath(sessionDir);
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const persisted: PersistedTodo = {
		version: 1,
		phases: todo.phases,
		nextTaskId: todo.nextTaskId,
		nextPhaseId: todo.nextPhaseId,
		updatedAt: new Date().toISOString(),
	};
	writeFileSync(filePath, JSON.stringify(persisted, null, 2));
}

// =============================================================================
// State helpers
// =============================================================================

function makeEmptyFile(): TodoFile {
	return { phases: [], nextTaskId: 1, nextPhaseId: 1 };
}

function findTask(phases: TodoPhase[], id: string): TodoItem | undefined {
	for (const phase of phases) {
		const task = phase.tasks.find((t) => t.id === id);
		if (task) return task;
	}
	return undefined;
}

function buildPhaseFromInput(
	input: { name: string; tasks?: Array<{ content: string; status?: TodoStatus; notes?: string; details?: string }> },
	phaseId: string,
	nextTaskId: number,
): { phase: TodoPhase; nextTaskId: number } {
	const tasks: TodoItem[] = [];
	let tid = nextTaskId;
	for (const t of input.tasks ?? []) {
		tasks.push({
			id: `task-${tid++}`,
			content: t.content,
			status: t.status ?? "pending",
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

function fileFromPhases(phases: TodoPhase[]): TodoFile {
	const { nextTaskId, nextPhaseId } = getNextIds(phases);
	return { phases, nextTaskId, nextPhaseId };
}

function clonePhases(phases: TodoPhase[]): TodoPhase[] {
	return phases.map((phase) => ({ ...phase, tasks: phase.tasks.map((task) => ({ ...task })) }));
}

export function normalizeInProgressTask(phases: TodoPhase[]): void {
	const orderedTasks = phases.flatMap((phase) => phase.tasks);
	if (orderedTasks.length === 0) return;

	const inProgressTasks = orderedTasks.filter((task) => task.status === "in_progress");
	if (inProgressTasks.length > 1) {
		for (const task of inProgressTasks.slice(1)) {
			task.status = "pending";
		}
	}

	if (inProgressTasks.length > 0) return;

	const firstPendingTask = orderedTasks.find((task) => task.status === "pending");
	if (firstPendingTask) firstPendingTask.status = "in_progress";
}

export function getLatestTodoPhasesFromEntries(entries: SessionEntry[]): TodoPhase[] {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message") continue;

		const message = entry.message as { role?: string; toolName?: string; details?: unknown; isError?: boolean };
		if (message.role !== "toolResult" || message.toolName !== "todo_write" || message.isError) continue;

		const details = message.details as { phases?: unknown } | undefined;
		if (!details || !Array.isArray(details.phases)) continue;

		return clonePhases(details.phases as TodoPhase[]);
	}

	return [];
}

export function applyOps(file: TodoFile, ops: TodoWriteParams["ops"]): { file: TodoFile; errors: string[] } {
	const errors: string[] = [];

	for (const op of ops) {
		switch (op.op) {
			case "replace": {
				const next = makeEmptyFile();
				for (const inputPhase of op.phases) {
					const phaseId = `phase-${next.nextPhaseId++}`;
					const { phase, nextTaskId } = buildPhaseFromInput(inputPhase, phaseId, next.nextTaskId);
					next.phases.push(phase);
					next.nextTaskId = nextTaskId;
				}
				file = next;
				break;
			}

			case "add_phase": {
				const phaseId = `phase-${file.nextPhaseId++}`;
				const { phase, nextTaskId } = buildPhaseFromInput(op, phaseId, file.nextTaskId);
				file.phases.push(phase);
				file.nextTaskId = nextTaskId;
				break;
			}

			case "add_task": {
				const target = file.phases.find((p) => p.id === op.phase);
				if (!target) {
					errors.push(`Phase "${op.phase}" not found`);
					break;
				}
				target.tasks.push({
					id: `task-${file.nextTaskId++}`,
					content: op.content,
					status: "pending",
					notes: op.notes,
					details: op.details,
				});
				break;
			}

			case "update": {
				const task = findTask(file.phases, op.id);
				if (!task) {
					errors.push(`Task "${op.id}" not found`);
					break;
				}
				if (op.status !== undefined) task.status = op.status;
				if (op.content !== undefined) task.content = op.content;
				if (op.notes !== undefined) task.notes = op.notes;
				if (op.details !== undefined) task.details = op.details;
				break;
			}

			case "remove_task": {
				let removed = false;
				for (const phase of file.phases) {
					const idx = phase.tasks.findIndex((t) => t.id === op.id);
					if (idx !== -1) {
						phase.tasks.splice(idx, 1);
						removed = true;
						break;
					}
				}
				if (!removed) errors.push(`Task "${op.id}" not found`);
				break;
			}
		}
	}

	normalizeInProgressTask(file.phases);
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

	// Find current phase
	let currentIdx = phases.findIndex((p) => p.tasks.some((t) => t.status === "pending" || t.status === "in_progress"));
	if (currentIdx === -1) currentIdx = phases.length - 1;
	const current = phases[currentIdx];
	const done = current.tasks.filter((t) => t.status === "completed" || t.status === "abandoned").length;

	const lines: string[] = [];
	if (errors.length > 0) lines.push(`Errors: ${errors.join("; ")}`);
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
		`Phase ${currentIdx + 1}/${phases.length} "${current.name}" — ${done}/${current.tasks.length} tasks complete`,
	);
	for (const phase of phases) {
		lines.push(`  ${phase.name}:`);
		for (const task of phase.tasks) {
			const sym =
				task.status === "completed"
					? "✓"
					: task.status === "in_progress"
						? "→"
						: task.status === "abandoned"
							? "✗"
							: "○";
			lines.push(`    ${sym} ${task.id} ${task.content}`);
		}
	}
	return lines.join("\n");
}

// =============================================================================
// Tool Class
// =============================================================================

export class TodoWriteTool implements AgentTool<typeof todoWriteSchema, TodoWriteToolDetails> {
	readonly name = "todo_write";
	readonly label = "Todo Write";
	readonly description =
		"Manages phased task lists. Use for multi-step tasks. \
\n\n"
		+ "Ops: \
\n"
		+ "- update: mark task in_progress BEFORE starting, completed AFTER (NOT before), abandoned (dropped). \
\n"
		+ "- add_task: add task to existing phase. Phase ID format: phase-1, phase-2, etc. \
\n"
		+ "- add_phase: create new phase. \
\n"
		+ "- replace: full reset (initial setup only). \
\n"
		+ "- remove_task: delete task. \
\n\n"
		+ "Rules: \
\n"
		+ "- Keep exactly ONE task in_progress at a time. \
\n"
		+ "- Mark in_progress BEFORE work, completed IMMEDIATELY after (no batching). \
\n"
		+ "- Use for tasks with 3+ distinct steps, or when user explicitly requests. \
\n\n"
		+ "Examples: \
\n"
		+ "- Start task: {op:'update',id:'task-1',status:'in_progress'} \
\n"
		+ "- Complete and start next: {op:'update',id:'task-1',status:'completed'},{op:'update',id:'task-2',status:'in_progress'} \
\n"
		+ "- Add task to phase-1: {op:'add_task',phase:'phase-1',content:'Fix authentication bug'} \
\n"
		+ "- Create todo: {op:'replace',phases:[{name:'Phase 1',tasks:[{content:'Read source'},{content:'Apply fix'},{content:'Test'}]}]}";
	readonly promptSnippet = "Manage todo/task lists with phases and tasks";
	readonly promptGuidelines = [
		"Use todo_write tool for multi-step tasks - do NOT create .md files",
		"Keep exactly ONE task in_progress at a time"
	];
	readonly parameters = todoWriteSchema;
	readonly concurrency = "exclusive";
	readonly strict = true;

	constructor(private session: AgentSession) {
		// Description is set inline
	}

	async execute(
		_toolCallId: string,
		params: TodoWriteParams,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<TodoWriteToolDetails>,
		_context?: unknown,
	): Promise<AgentToolResult<TodoWriteToolDetails>> {
		// Load persisted todo if not in memory
		let previousPhases = this.session.getTodoPhases();
		if (previousPhases.length === 0 && this.session.sessionFile) {
			const loaded = loadTodoFromFile(this.session.sessionDir);
			if (loaded) {
				previousPhases = loaded.phases;
				this.session.setTodoPhases(previousPhases);
			}
		}

		const current = fileFromPhases(previousPhases);
		const { file: updated, errors } = applyOps(current, params.ops);
		this.session.setTodoPhases(updated.phases);

		// Save to file if session is being persisted
		if (this.session.sessionFile) {
			saveTodoToFile(this.session.sessionDir, updated);
		}

		const storage = this.session.sessionFile ? "session" : "memory";

		// Auto-trigger: after creating/updating todo, continue with first pending task
		const hasNewOrUpdatedTodos = params.ops.some(
			(op) => op.op === "replace" || op.op === "add_phase" || op.op === "add_task",
		);

		if (hasNewOrUpdatedTodos) {
			// Find first in_progress or pending task to work on
			const nextTask = updated.phases
				.flatMap((p) => p.tasks)
				.find((t) => t.status === "in_progress" || t.status === "pending");

			if (nextTask) {
				// Wait for agent to finish current turn (agent_end) before continuing
				// This ensures the tool result is fully processed first
				const unsubscribe = this.session.subscribe((event) => {
					if (event.type === "agent_end") {
						// Increase timeout to allow agent to fully process the tool result
						setTimeout(() => {
							// Check again after timeout - agent might still be processing
							if (!this.session.isStreaming) {
								this.session.agent.continue().catch(() => {});
							}
						}, 200);
						unsubscribe();
					}
				});
			}
		}

		return {
			content: [{ type: "text", text: formatSummary(updated.phases, errors) }],
			details: { phases: updated.phases, storage },
		};
	}
}

// =============================================================================
// TUI Renderer
// =============================================================================

interface TodoWriteRenderArgs {
	ops?: Array<{ op: string }>;
}

function formatTodoLine(item: TodoItem, theme: Theme, prefix: string): string {
	switch (item.status) {
		case "completed":
			return theme.fg("success", `${prefix}[✓] ${chalk.strikethrough(item.content)}`);
		case "in_progress": {
			const main = theme.fg("accent", `${prefix}[→] ${item.content}`);
			if (!item.details) return main;
			const detailLines = item.details.split("\n").map((l) => theme.fg("dim", `${prefix}  ${l}`));
			return [main, ...detailLines].join("\n");
		}
		case "abandoned":
			return theme.fg("error", `${prefix}[✗] ${chalk.strikethrough(item.content)}`);
		default:
			return theme.fg("dim", `${prefix}[ ] ${item.content}`);
	}
}

export const todoWriteToolRenderer = {
	renderCall(args: TodoWriteRenderArgs, _options: unknown, theme: Theme): Component {
		const count = args.ops?.length ?? 0;
		const label = count === 1 ? (args.ops?.[0]?.op ?? "update") : `${count} ops`;
		const text = `Todo Write: ${label}`;
		return new Text(theme.fg("toolTitle", text), 0, 0);
	},

	renderResult(
		result: { content: Array<{ type: string; text?: string }>; details?: TodoWriteToolDetails },
		options: { expanded?: boolean },
		theme: Theme,
		_args?: TodoWriteRenderArgs,
	): Component {
		const phases = (result.details?.phases ?? []).filter((p) => p.tasks.length > 0);
		const allTasks = phases.flatMap((p) => p.tasks);

		const header = `Todo Write: ${allTasks.length} tasks`;
		if (allTasks.length === 0) {
			const fallback = result.content?.find((c) => c.type === "text")?.text ?? "No todos";
			return new Text(`${theme.fg("dim", header)}\n${theme.fg("dim", fallback)}`, 0, 0);
		}

		const { expanded } = options;
		const lines: string[] = [theme.fg("toolTitle", header)];

		for (const phase of phases) {
			if (phases.length > 1) {
				lines.push(theme.fg("accent", `  ▼ ${phase.name}`));
			}
			const displayTasks = expanded ? phase.tasks : phase.tasks.slice(0, 5);
			for (const task of displayTasks) {
				lines.push(formatTodoLine(task, theme, "    "));
			}
			if (!expanded && phase.tasks.length > 5) {
				lines.push(theme.fg("dim", `    ... ${phase.tasks.length - 5} more`));
			}
		}
		return new Text(lines.join("\n"), 0, 0);
	},
	mergeCallAndResult: true,
};