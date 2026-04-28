import { beforeEach, describe, expect, it } from "vitest";
import {
	applySingleOp,
	formatSummary,
	getLatestTodoPhasesFromEntries,
	normalizeInProgressTask,
	type TodoPhase,
} from "../src/core/tools/todo-write.js";

interface TodoFile {
	phases: TodoPhase[];
	nextTaskId: number;
	nextPhaseId: number;
}

describe("applySingleOp", () => {
	let file: TodoFile;

	beforeEach(() => {
		file = { phases: [], nextTaskId: 1, nextPhaseId: 1 };
	});

	it("should replace all phases", () => {
		const result = applySingleOp(file, {
			replace: {
				phases: [{ name: "Phase 1", tasks: [{ content: "Task 1" }, { content: "Task 2" }] }],
			},
		});

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].tasks).toHaveLength(2);
		expect(result.file.phases[0].tasks[0].id).toBe("task-1");
	});

	it("should add a new phase", () => {
		const result = applySingleOp(file, {
			add_phase: { name: "New Phase" },
		});

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].name).toBe("New Phase");
	});

	it("should add task to existing phase", () => {
		file.phases.push({ id: "phase-1", name: "Phase 1", tasks: [] });

		const result = applySingleOp(file, {
			add_task: { phase: "phase-1", content: "New Task" },
		});

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks).toHaveLength(1);
		expect(file.phases[0].tasks[0].content).toBe("New Task");
	});

	it("should return error for non-existent phase on add_task", () => {
		const result = applySingleOp(file, {
			add_task: { phase: "phase-999", content: "Task" },
		});

		expect(result.errors).toContain('Phase "phase-999" not found');
	});

	it("should update task properties", () => {
		file.phases.push({
			id: "phase-1",
			name: "Phase 1",
			tasks: [{ id: "task-1", content: "Original", status: "pending" }],
		});

		const result = applySingleOp(file, {
			update: { id: "task-1", content: "Updated", status: "completed" },
		});

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks[0].content).toBe("Updated");
		expect(file.phases[0].tasks[0].status).toBe("completed");
	});

	it("should return error for non-existent task on update", () => {
		const result = applySingleOp(file, {
			update: { id: "task-999", status: "completed" },
		});

		expect(result.errors).toContain('Task "task-999" not found');
	});

	it("should remove task", () => {
		file.phases.push({
			id: "phase-1",
			name: "Phase 1",
			tasks: [{ id: "task-1", content: "To Remove", status: "pending" }],
		});

		const result = applySingleOp(file, {
			remove_task: { id: "task-1" },
		});

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks).toHaveLength(0);
	});

	it("should return error for non-existent task on remove", () => {
		const result = applySingleOp(file, {
			remove_task: { id: "task-999" },
		});

		expect(result.errors).toContain('Task "task-999" not found');
	});

	it("should handle multiple ops in sequence", () => {
		let result = applySingleOp(file, {
			add_phase: { name: "Phase 1" },
		});
		file = result.file;

		result = applySingleOp(file, {
			add_task: { phase: "phase-1", content: "Task 1" },
		});
		file = result.file;

		result = applySingleOp(file, {
			add_task: { phase: "phase-1", content: "Task 2" },
		});

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].tasks).toHaveLength(2);
	});

	it("should return error when no operation specified", () => {
		const result = applySingleOp(file, {});

		expect(result.errors).toContain("No operation specified");
	});

	it("should list current todos without modification", () => {
		// First add some data
		let result = applySingleOp(file, {
			add_phase: { name: "Phase 1", tasks: [{ content: "Task 1" }, { content: "Task 2" }] },
		});
		file = result.file;

		// Now list
		result = applySingleOp(file, {
			list: {},
		});

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].tasks).toHaveLength(2);
		expect(result.file.phases[0].name).toBe("Phase 1");
	});

	it("should list empty todos", () => {
		const result = applySingleOp(file, {
			list: {},
		});

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(0);
	});

	it("should handle add_phase with tasks", () => {
		const result = applySingleOp(file, {
			add_phase: {
				name: "Phase with tasks",
				tasks: [{ content: "Task 1" }, { content: "Task 2" }],
			},
		});

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].tasks).toHaveLength(2);
	});

	it("should handle add_task with notes and details", () => {
		file.phases.push({ id: "phase-1", name: "Phase 1", tasks: [] });

		const result = applySingleOp(file, {
			add_task: {
				phase: "phase-1",
				content: "Task with details",
				notes: "Important task",
				details: "Implementation details",
			},
		});

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks[0].notes).toBe("Important task");
		expect(file.phases[0].tasks[0].details).toBe("Implementation details");
	});

	it("should handle update with partial fields", () => {
		file.phases.push({
			id: "phase-1",
			name: "Phase 1",
			tasks: [{ id: "task-1", content: "Original", status: "pending", notes: "Old notes" }],
		});

		const result = applySingleOp(file, {
			update: { id: "task-1", content: "Updated" },
		});

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks[0].content).toBe("Updated");
		expect(file.phases[0].tasks[0].status).toBe("in_progress"); // normalized
		expect(file.phases[0].tasks[0].notes).toBe("Old notes"); // unchanged
	});
});

describe("normalizeInProgressTask", () => {
	it("should set first pending task to in_progress when no in_progress exists", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{ id: "task-1", content: "Task 1", status: "pending" },
					{ id: "task-2", content: "Task 2", status: "pending" },
				],
			},
		];

		normalizeInProgressTask(phases);

		expect(phases[0].tasks[0].status).toBe("in_progress");
		expect(phases[0].tasks[1].status).toBe("pending");
	});

	it("should keep existing in_progress task", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{ id: "task-1", content: "Task 1", status: "in_progress" },
					{ id: "task-2", content: "Task 2", status: "pending" },
				],
			},
		];

		normalizeInProgressTask(phases);

		expect(phases[0].tasks[0].status).toBe("in_progress");
	});

	it("should convert extra in_progress to pending", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{ id: "task-1", content: "Task 1", status: "in_progress" },
					{ id: "task-2", content: "Task 2", status: "in_progress" },
					{ id: "task-3", content: "Task 3", status: "pending" },
				],
			},
		];

		normalizeInProgressTask(phases);

		expect(phases[0].tasks[0].status).toBe("in_progress");
		expect(phases[0].tasks[1].status).toBe("pending");
		expect(phases[0].tasks[2].status).toBe("pending");
	});

	it("should do nothing for empty phases", () => {
		const phases: TodoPhase[] = [];

		normalizeInProgressTask(phases);

		expect(phases).toHaveLength(0);
	});

	it("should not change completed tasks to in_progress", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{ id: "task-1", content: "Task 1", status: "completed" },
					{ id: "task-2", content: "Task 2", status: "abandoned" },
				],
			},
		];

		normalizeInProgressTask(phases);

		expect(phases[0].tasks[0].status).toBe("completed");
		expect(phases[0].tasks[1].status).toBe("abandoned");
	});
});

describe("formatSummary", () => {
	it("should return message for empty phases with errors", () => {
		const result = formatSummary([], ["Error 1", "Error 2"]);

		expect(result).toContain("Errors: Error 1; Error 2");
	});

	it("should return cleared message for empty phases", () => {
		const result = formatSummary([], []);

		expect(result).toBe("Todo list cleared.");
	});

	it("should format phases with tasks correctly", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{ id: "task-1", content: "Task 1", status: "pending" },
					{ id: "task-2", content: "Task 2", status: "completed" },
				],
			},
		];

		const result = formatSummary(phases, []);

		expect(result).toContain("Todo updated: 1 remaining, 1 completed");
		expect(result).toContain('Phase 1/1 "Phase 1"');
	});

	it("should show task details for in_progress tasks", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{
						id: "task-1",
						content: "Task 1",
						status: "in_progress",
						details: "Line 1\nLine 2",
					},
				],
			},
		];

		const result = formatSummary(phases, []);

		expect(result).toContain("Line 1");
		expect(result).toContain("Line 2");
	});
});

describe("getLatestTodoPhasesFromEntries", () => {
	it("should return empty array when no entries", () => {
		const result = getLatestTodoPhasesFromEntries([]);

		expect(result).toEqual([]);
	});

	it("should return empty array when no tool results", () => {
		const entries = [
			{
				type: "message",
				message: { role: "user", content: "Hello" },
			},
		] as any[];

		const result = getLatestTodoPhasesFromEntries(entries);

		expect(result).toEqual([]);
	});

	it("should return empty array when no todo_write results", () => {
		const entries = [
			{
				type: "message",
				message: { role: "toolResult", toolName: "other_tool", details: { phases: [] } },
			},
		] as any[];

		const result = getLatestTodoPhasesFromEntries(entries);

		expect(result).toEqual([]);
	});

	it("should return empty array for error tool results", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "todo_write",
					details: { phases: [] },
					isError: true,
				},
			},
		] as any[];

		const result = getLatestTodoPhasesFromEntries(entries);

		expect(result).toEqual([]);
	});

	it("should return phases from valid todo_write result", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [{ id: "task-1", content: "Task 1", status: "pending" }],
			},
		];

		const entries = [
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "todo_write",
					details: { phases },
					isError: false,
				},
			},
		] as any[];

		const result = getLatestTodoPhasesFromEntries(entries);

		expect(result).toEqual(phases);
	});

	it("should return most recent phases when multiple todo results", () => {
		const oldPhases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Old Phase",
				tasks: [{ id: "task-1", content: "Old Task", status: "completed" }],
			},
		];

		const newPhases: TodoPhase[] = [
			{
				id: "phase-2",
				name: "New Phase",
				tasks: [{ id: "task-2", content: "New Task", status: "pending" }],
			},
		];

		const entries = [
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "todo_write",
					details: { phases: oldPhases },
					isError: false,
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "todo_write",
					details: { phases: newPhases },
					isError: false,
				},
			},
		] as any[];

		const result = getLatestTodoPhasesFromEntries(entries);

		expect(result).toEqual(newPhases);
	});

	it("should skip entries without phases array", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [{ id: "task-1", content: "Task 1", status: "pending" }],
			},
		];

		const entries = [
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "todo_write",
					details: { somethingElse: [] },
					isError: false,
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "todo_write",
					details: { phases },
					isError: false,
				},
			},
		] as any[];

		const result = getLatestTodoPhasesFromEntries(entries);

		expect(result).toEqual(phases);
	});
});
