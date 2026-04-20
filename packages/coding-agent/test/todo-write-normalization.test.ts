import { describe, expect, it } from "vitest";
import { normalizeParams } from "../src/core/tools/todo-write.js";

describe("TodoWrite Tool - Input Normalization", () => {
	describe("normalizeParams", () => {
		it("should handle valid object input", () => {
			const input = {
				add_phase: {
					name: "Test Phase",
					tasks: [{ content: "Task 1" }],
				},
			};
			const result = normalizeParams(input);
			expect(result).toEqual(input);
		});

		it("should handle stringified JSON input", () => {
			const input = JSON.stringify({
				add_phase: {
					name: "Test Phase",
					tasks: [{ content: "Task 1" }],
				},
			});
			const result = normalizeParams(input);
			expect(result.add_phase).toEqual({
				name: "Test Phase",
				tasks: [{ content: "Task 1" }],
			});
		});

		it("should handle add_phase as string", () => {
			const input = {
				add_phase: JSON.stringify({
					name: "Test Phase",
					tasks: [{ content: "Task 1" }],
				}),
			};
			const result = normalizeParams(input);
			expect(result.add_phase).toEqual({
				name: "Test Phase",
				tasks: [{ content: "Task 1" }],
			});
		});

		it("should handle add_phase.name containing full object (common LLM error)", () => {
			const input = {
				add_phase: {
					name: JSON.stringify({
						name: "Test Phase",
						tasks: [{ content: "Task 1" }],
					}),
				},
			};
			const result = normalizeParams(input);
			expect(result.add_phase).toEqual({
				name: "Test Phase",
				tasks: [{ content: "Task 1" }],
			});
		});

		it("should handle tasks as comma-separated string", () => {
			const input = {
				add_phase: {
					name: "Test Phase",
					tasks: "Task 1, Task 2, Task 3",
				},
			};
			const result = normalizeParams(input);
			expect(result.add_phase?.tasks).toEqual([{ content: "Task 1" }, { content: "Task 2" }, { content: "Task 3" }]);
		});

		it("should handle tasks as stringified JSON array", () => {
			const input = {
				add_phase: {
					name: "Test Phase",
					tasks: JSON.stringify([{ content: "Task 1" }, { content: "Task 2" }]),
				},
			};
			const result = normalizeParams(input);
			expect(result.add_phase?.tasks).toEqual([{ content: "Task 1" }, { content: "Task 2" }]);
		});

		it("should handle replace.phases as string", () => {
			const input = {
				replace: {
					phases: JSON.stringify([{ name: "Phase 1", tasks: [{ content: "Task 1" }] }]),
				},
			};
			const result = normalizeParams(input);
			expect(result.replace?.phases).toEqual([{ name: "Phase 1", tasks: [{ content: "Task 1" }] }]);
		});

		it("should throw error for invalid JSON string", () => {
			const input = "{ invalid json }";
			expect(() => normalizeParams(input)).toThrow("Invalid JSON string");
		});

		it("should throw error for null input", () => {
			expect(() => normalizeParams(null)).toThrow("Parameters must be an object");
		});

		it("should throw error for non-object input", () => {
			expect(() => normalizeParams(123)).toThrow("Parameters must be an object");
		});

		it("should throw error for invalid add_phase string", () => {
			const input = {
				add_phase: "{ invalid json }",
			};
			expect(() => normalizeParams(input)).toThrow("add_phase must be an object, not a string");
		});

		it("should throw error for invalid replace.phases string", () => {
			const input = {
				replace: {
					phases: "{ invalid json }",
				},
			};
			expect(() => normalizeParams(input)).toThrow("replace.phases must be an array, not a string");
		});

		it("should handle add_task operation", () => {
			const input = {
				add_task: {
					phase: "phase-1",
					content: "New task",
				},
			};
			const result = normalizeParams(input);
			expect(result.add_task).toEqual({
				phase: "phase-1",
				content: "New task",
			});
		});

		it("should handle update operation", () => {
			const input = {
				update: {
					id: "task-1",
					status: "completed",
				},
			};
			const result = normalizeParams(input);
			expect(result.update).toEqual({
				id: "task-1",
				status: "completed",
			});
		});

		it("should handle remove_task operation", () => {
			const input = {
				remove_task: {
					id: "task-1",
				},
			};
			const result = normalizeParams(input);
			expect(result.remove_task).toEqual({
				id: "task-1",
			});
		});

		it("should preserve optional fields", () => {
			const input = {
				add_phase: {
					name: "Test Phase",
					tasks: [
						{
							content: "Task 1",
							status: "in_progress",
							notes: "Important task",
							details: "Implementation details",
						},
					],
				},
			};
			const result = normalizeParams(input);
			expect(result.add_phase?.tasks?.[0]).toEqual({
				content: "Task 1",
				status: "in_progress",
				notes: "Important task",
				details: "Implementation details",
			});
		});
	});
});
