import { beforeEach, describe, expect, it } from "vitest";
import {
	applyOps,
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

describe("applyOps", () => {
	let file: TodoFile;

	beforeEach(() => {
		file = { phases: [], nextTaskId: 1, nextPhaseId: 1 };
	});

	it("should replace all phases", () => {
		const result = applyOps(file, [
			{
				op: "replace",
				phases: [{ name: "Phase 1", tasks: [{ content: "Task 1" }, { content: "Task 2" }] }],
			},
		]);

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].tasks).toHaveLength(2);
		expect(result.file.phases[0].tasks[0].id).toBe("task-1");
	});

	it("should add a new phase", () => {
		const result = applyOps(file, [{ op: "add_phase", name: "New Phase" }]);

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].name).toBe("New Phase");
	});

	it("should add task to existing phase", () => {
		file.phases.push({ id: "phase-1", name: "Phase 1", tasks: [] });

		const result = applyOps(file, [{ op: "add_task", phase: "phase-1", content: "New Task" }]);

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks).toHaveLength(1);
		expect(file.phases[0].tasks[0].content).toBe("New Task");
	});

	it("should return error for non-existent phase on add_task", () => {
		const result = applyOps(file, [{ op: "add_task", phase: "phase-999", content: "Task" }]);

		expect(result.errors).toContain('Phase "phase-999" not found');
	});

	it("should update task properties", () => {
		file.phases.push({
			id: "phase-1",
			name: "Phase 1",
			tasks: [{ id: "task-1", content: "Original", status: "pending" }],
		});

		const result = applyOps(file, [{ op: "update", id: "task-1", content: "Updated", status: "completed" }]);

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks[0].content).toBe("Updated");
		expect(file.phases[0].tasks[0].status).toBe("completed");
	});

	it("should return error for non-existent task on update", () => {
		const result = applyOps(file, [{ op: "update", id: "task-999", status: "completed" }]);

		expect(result.errors).toContain('Task "task-999" not found');
	});

	it("should remove task", () => {
		file.phases.push({
			id: "phase-1",
			name: "Phase 1",
			tasks: [{ id: "task-1", content: "To Remove", status: "pending" }],
		});

		const result = applyOps(file, [{ op: "remove_task", id: "task-1" }]);

		expect(result.errors).toHaveLength(0);
		expect(file.phases[0].tasks).toHaveLength(0);
	});

	it("should return error for non-existent task on remove", () => {
		const result = applyOps(file, [{ op: "remove_task", id: "task-999" }]);

		expect(result.errors).toContain('Task "task-999" not found');
	});

	it("should handle multiple ops in sequence", () => {
		const result = applyOps(file, [
			{ op: "add_phase", name: "Phase 1" },
			{ op: "add_task", phase: "phase-1", content: "Task 1" },
			{ op: "add_task", phase: "phase-1", content: "Task 2" },
		]);

		expect(result.errors).toHaveLength(0);
		expect(result.file.phases).toHaveLength(1);
		expect(result.file.phases[0].tasks).toHaveLength(2);
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
				],
			},
		];

		normalizeInProgressTask(phases);

		expect(phases[0].tasks[0].status).toBe("in_progress");
		expect(phases[0].tasks[1].status).toBe("pending");
	});

	it("should do nothing for empty phases", () => {
		const phases: TodoPhase[] = [];

		expect(() => normalizeInProgressTask(phases)).not.toThrow();
	});

	it("should not change completed tasks to in_progress", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{ id: "task-1", content: "Task 1", status: "completed" },
					{ id: "task-2", content: "Task 2", status: "completed" },
				],
			},
		];

		normalizeInProgressTask(phases);

		// Completed tasks should NOT be changed to in_progress
		// Only pending tasks can become in_progress
		expect(phases[0].tasks[0].status).toBe("completed");
		expect(phases[0].tasks[1].status).toBe("completed");
	});
});

describe("formatSummary", () => {
	it("should return message for empty phases with errors", () => {
		const phases: TodoPhase[] = [];
		const result = formatSummary(phases, ["Error 1"]);

		expect(result).toContain("Errors: Error 1");
	});

	it("should return cleared message for empty phases", () => {
		const phases: TodoPhase[] = [];
		const result = formatSummary(phases, []);

		expect(result).toBe("Todo list cleared.");
	});

	it("should format phases with tasks correctly", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{ id: "task-1", content: "Task 1", status: "in_progress" },
					{ id: "task-2", content: "Task 2", status: "pending" },
					{ id: "task-3", content: "Task 3", status: "completed" },
				],
			},
		];

		const result = formatSummary(phases, []);

		expect(result).toContain("→ task-1");
		expect(result).toContain("✓ task-3");
		expect(result).toContain("Phase 1");
	});

	it("should show task details for in_progress tasks", () => {
		const phases: TodoPhase[] = [
			{
				id: "phase-1",
				name: "Phase 1",
				tasks: [
					{
						id: "task-1",
						content: "Implementing feature",
						status: "in_progress",
						details: "File: src/main.ts\nLine: 42",
					},
				],
			},
		];

		const result = formatSummary(phases, []);

		expect(result).toContain("File: src/main.ts");
	});
});

describe("getLatestTodoPhasesFromEntries", () => {
	it("should return empty array when no entries", () => {
		const result = getLatestTodoPhasesFromEntries([]);
		expect(result).toEqual([]);
	});

	it("should return empty array when no tool results", () => {
		const entries = [{ type: "message", timestamp: 0, message: { role: "user", content: "Hello" } }];
		const result = getLatestTodoPhasesFromEntries(entries as any);
		expect(result).toEqual([]);
	});

	it("should return empty array when no todo_write results", () => {
		const entries = [
			{
				type: "message",
				timestamp: 0,
				message: { role: "toolResult", toolName: "bash", content: "result" },
			},
		];
		const result = getLatestTodoPhasesFromEntries(entries as any);
		expect(result).toEqual([]);
	});

	it("should return empty array for error tool results", () => {
		const entries = [
			{
				type: "message",
				timestamp: 0,
				message: { role: "toolResult", toolName: "todo_write", isError: true },
			},
		];
		const result = getLatestTodoPhasesFromEntries(entries as any);
		expect(result).toEqual([]);
	});

	it("should return phases from valid todo_write result", () => {
		const phases = [
			{ id: "phase-1", name: "Phase 1", tasks: [{ id: "task-1", content: "Task 1", status: "pending" as const }] },
		];
		const entries = [
			{
				type: "message",
				timestamp: 0,
				message: {
					role: "toolResult",
					toolName: "todo_write",
					details: { phases },
				},
			},
		];
		const result = getLatestTodoPhasesFromEntries(entries as any);
		expect(result).toEqual(phases);
	});

	it("should return most recent phases when multiple todo results", () => {
		const phases1 = [
			{ id: "phase-1", name: "Phase 1", tasks: [{ id: "task-1", content: "Old", status: "pending" as const }] },
		];
		const phases2 = [
			{ id: "phase-1", name: "Phase 1", tasks: [{ id: "task-1", content: "New", status: "in_progress" as const }] },
		];
		const entries = [
			{
				type: "message",
				timestamp: 1,
				message: { role: "toolResult", toolName: "todo_write", details: { phases: phases1 } },
			},
			{
				type: "message",
				timestamp: 2,
				message: { role: "toolResult", toolName: "todo_write", details: { phases: phases2 } },
			},
		];
		const result = getLatestTodoPhasesFromEntries(entries as any);
		expect(result[0].tasks[0].content).toBe("New");
	});

	it("should skip entries without phases array", () => {
		const entries = [
			{
				type: "message",
				timestamp: 0,
				message: { role: "toolResult", toolName: "todo_write", details: { notPhases: true } },
			},
		];
		const result = getLatestTodoPhasesFromEntries(entries as any);
		expect(result).toEqual([]);
	});
});
